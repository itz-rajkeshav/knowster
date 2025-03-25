import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import prisma from "../db/prismaDB";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

declare module "express" {
  interface Request {
    user?: {
      id: string;
      email: string;
      name: string;
      profileImage: string | null;
      phoneNo: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }
}

interface DecodedToken extends JwtPayload {
  id: string;
}

export const verifyJWT = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.accessToken || 
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(
      token, 
      process.env.ACCESS_TOKEN_SECRET as string
    ) as DecodedToken;

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.id },
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
        phoneNo: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }

    req.user = user;
    next();
    
  } catch (error) {
    const errorMessage = error instanceof Error ? 
      error.message : 
      "Invalid access token";
    throw new ApiError(401, errorMessage);
  }
});