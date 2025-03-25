import { OAuth2Client, TokenPayload } from "google-auth-library";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { generateTokens } from "../controllers/User.controller.js";
import prisma from "../../db/prismaDB.js";
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

interface GoogleSignInRequest extends Request {
    body: {
        idToken: string;
    }
}

const googleSignIn = asyncHandler(async (req: GoogleSignInRequest, res: Response) => {
    const { idToken } = req.body;
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload() as TokenPayload;
    
    if (!payload) {
        throw new ApiError(400, "Invalid ID token");
    }

    const { picture, sub, name, email } = payload;
    
    if (!sub || !email || !name) {
        throw new ApiError(400, "Missing required fields in ID token payload");
    }

    let user = await prisma.user.findUnique({
        where: {
            provider_providerId: {
                provider: "google",
                providerId: sub,
            },
        },
    });

    if (!user) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new ApiError(409, "Email already registered with another account");
        }
    }

    if (!user) {
        const randomPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        
        user = await prisma.user.create({
            data: {
                email,
                provider: "google",
                providerId: sub,
                name: name,
                profileImage: picture,
                password: hashedPassword
            }
        });
    }

    const { accessToken, refreshToken } = await generateTokens(user.id);
    
    // Omit sensitive fields from the response
    const { password, refreshToken: _, ...userResponse } = user;

    return res
        .status(200)
        .cookie('accessToken', accessToken, { httpOnly: true, secure: true })
        .cookie('refreshToken', refreshToken, { httpOnly: true, secure: true })
        .json(
            new ApiResponse(
                200, 
                { 
                    user: userResponse, 
                    accessToken, 
                    refreshToken 
                }, 
                'Google sign-in successful'
            )
        );
});

function generateRandomPassword(): string {
    return Math.random().toString(36).slice(-8);
}

export { googleSignIn };