import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {  ApiResponse } from "../utils/ApiResponse.js"
import fs from "fs"
import jsonwebtoken from "jsonwebtoken"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId)=>{
    try{
        const user = await User.findById(userId)
        const  accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return { accessToken, refreshToken}
    } catch(error){
        throw new ApiError(500, "Something went wrong while generating refresh and access tokens ")
    }
}
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
const loginUser = asyncHandler(async (req, res)=>{
    //req.body se data lana
    console.log(req.body)
    const {email, username, password} = req.body

    if(!(username ||  email)){
        throw new ApiError(400, "username or password is required")

    }
    // find the user
    const user = await User.findOne({
        $or: [{username}, {email}] // Finding either on the basis of username or email
    })
    // username or email hai ya nahi
    if(!user){
        throw new ApiError(404, "user does not exist")
    }
    
    //password  check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "invalid user credentials")
    }
    // access and refresh token generate and send to user(cookies)
    const {accessToken,refreshToken} =  await generateAccessAndRefreshTokens(user._id)
    
    const loggedInUser =  await User.findById(user._id).
     // Why this? We had access of User(from mongoose)
     //We updated the refreshtoken and access token 
     // but from the database we will have to call it again to get these values too which the Before user didnt have
    select("-password -refreshToken") // used for excluding password and refreshtokens, they wont be coming in the  user here

    //Now the loggedInUser has everything which is need to be sent back
    //send cookies
    const options = {
        httpOnly: true, // cookies only modified through server 
        secure: false
    }
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            }, 
            "User logged in Successfully"
        )
    )

})

const logoutUser =  asyncHandler(async(req,res)=>{
    //auth.middleware se  req.user add hogya tha
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new : true
        }
    )
    const options = {
        httpOnly: true, // cookies only modified through server 
        secure: true
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200,{}, "User loggedOut"))
})

const refreshAccessToken = asyncHandler( async(req,res)=> {
    incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }
   try {
    const decodedToken= jwt.verify(
         incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET
     )
 
     const user = await User.findById(decodedToken?._id) 
     if(!user){
         throw new  ApiError(401, "Invalid RefreshToken")
     }
     if(incomingRefreshToken !== user?.refreshToken){
         throw new ApiError(401,    "REfresh token is expired or used")
     }
     const options={
         httpOnly:true,
         secure: false
     }
     const {accessToken,newrefreshToken}= await generateAccessAndRefreshTokens(user._id)
     return res
     .status(200)
     .cookie("accessToken", accessToken)
     .cookie("refreshToken", newrefreshToken)
     .json(
         new ApiResponse(
             200,
             {accessToken, refreshToken : newrefreshToken},
             "Access Token refreshed succesfully"
         )
     )
   } catch (error) {
    throw new ApiError(401, error?.message || " Invalid refresh token")
   }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid  old password")
    }
    user.password =  newPassword
    await user.save({ validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200,{}, "Password changed succesfully"))
})
const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName, email}  = req.body

    if(!fullName || !email){
        throw new ApiError  (400, "All fields are required")
    }
    const user = await User.findByIdAndUpdate(req.user?._id ,
        {
            $set:{
                fullName,
                email
            }
        },
        {new:true}
    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account updated "))
 })
const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath= req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    } 
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar")
    } 
    const user = await User.findOneAndUpdate(req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new:true}
    ).select(-password)
    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar updated succesfully")
    )
})
const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath= req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400, "coverImageLocalPath file is missing")
    } 
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading coverImage")
    } 
    const user = await User.findOneAndUpdate(req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new:true}
    ).select(-password)
    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "coverImage updated succesfully")
    )
})
const getCurrentUser  =  asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully")
})

export {
    registerUser , 
    loginUser, 
    logoutUser , 
    refreshAccessToken, 
    updateAccountDetails, 
    changeCurrentPassword, 
    getCurrentUser , 
    updateUserAvatar, 
    updateUserCoverImage
}