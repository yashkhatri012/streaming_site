import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {  ApiResponse } from "../utils/ApiResponse.js"
import fs from "fs"
const registerUser = asyncHandler( async(req,res)=>{
    //get user details from frontend
    const {username, fullName, email, password} = req.body
    //validation if someone has sent empty strings
    if (
        [fullName, email, username,password].some((field)=>field?.trim() ==="")
    ){
        throw new ApiError(400,"All fileds are required");
        
    }
    
    //check if user already exists
    const existedUser= await User.findOne({
        $or:[{username}, {email}]
    })
    if (existedUser) {
         //console.log("Duplicate user found:", existedUser);
         // Clean up uploaded files
        if (req.files?.avatar?.[0]?.path) {
            fs.unlinkSync(req.files.avatar[0].path);
        }
        if (req.files?.coverImage?.[0]?.path) {
            fs.unlinkSync(req.files.coverImage[0].path);
        }
        throw new ApiError(409,"User already exists")
    }
    //check for images, and avatar
    // console.log(req.files.avatar[0].path)
    
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
   let coverImageLocalPath;
    if (req.files && Array.isArray( req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path}
    console.log(coverImageLocalPath)
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar Required")
    }
    //upload them to cloudinary, avatar
    const avatar =await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    //create user object- create entry in db
    const user=  await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    //remove password and refresh tokken field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //check for user creation
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the User")
    }
    
      
    //return res

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Succesfully")
    )
})

export {registerUser}