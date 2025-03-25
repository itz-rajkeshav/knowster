import { Router } from "express";
import {verifyJWT} from "../../middleware/auth.middleware"
import {createUser, logout,login, refreshAccessToken} from "../controllers/User.controller"
const router = Router();
router.route("/register").post(createUser);
router.route("/login").post(login);
router.route("/logout").get(logout,verifyJWT);
router.route("/refresh/Accesstoken").post(refreshAccessToken);
export default router;