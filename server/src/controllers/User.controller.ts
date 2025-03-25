import prisma from "../../db/prismaDB";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import bcrypt from "bcryptjs";
import Jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

interface CustomRequest extends Request {
  user?: { id: string }; // Extending request to include user
}

// Create User
const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password }: { email: string; password: string } = req.body;
  console.log(req.body);
  console.log(email, password);

  const existedUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existedUser) {
    throw new ApiError(409, "User is already created with this email id... Choose another email");
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashPassword,
      provider: "manual",
    },
  });

  const { password: _, ...userResponse } = newUser;
  return res.json(new ApiResponse(200, userResponse, "User registered successfully"));
});

// Generate Tokens
const generateTokens = async (userId: string) => {
  try {
    const accessToken = Jwt.sign({ id: userId }, process.env.ACCESS_TOKEN_SECRET as string, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "7d",
    });

    const refreshToken = Jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET as string, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "30d",
    });

    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Token generation error:", error);
    throw new Error("Failed to generate tokens");
  }
};

// Refresh Access Token
const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const RefreshToken: string = req.cookies.RefreshToken || req.body.RefreshToken;

  if (!RefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  try {
    const decodedToken = Jwt.verify(RefreshToken, process.env.REFRESH_TOKEN_SECRET as string) as {
      id: string;
    };

    const user = await prisma.user.findFirst({
      where: {
        id: decodedToken.id,
        refreshToken: RefreshToken,
      },
      select: {
        id: true,
        refreshToken: true,
      },
    });

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user.id);

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
    };

    return res
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed successfully"));
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// Login
const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password }: { email: string; password: string } = req.body;

  const existedUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      profileImage: true,
      provider: true,
      providerId: true,
      phoneNo: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existedUser) {
    throw new ApiError(409, "User is not found with this email. Please Sign In first");
  }

  const isPasswordCorrect = await bcrypt.compare(password, existedUser.password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid Password");
  }

  const { password: _, ...userData } = existedUser;
  const { accessToken, refreshToken } = await generateTokens(existedUser.id);

  await prisma.user.update({
    where: { id: existedUser.id },
    data: { refreshToken },
  });

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, userData, "User logged in successfully"));
});

// Logout
const logout = asyncHandler(async (req: CustomRequest, res: Response) => {
  if (!req.user?.id) {
    throw new ApiError(401, "User not authenticated");
  }

  const user_id = req.user.id;

  await prisma.user.update({
    where: { id: user_id },
    data: { refreshToken: null },
  });

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export { createUser, generateTokens, refreshAccessToken, login, logout };
