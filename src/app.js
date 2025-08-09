import express from "express"
import cors from 'cors'
import cookieParser from "cookie-parser"
const app =  express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials:true
}))
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(cookieParser())
app.use(express.json())


//routes import

import userRouter from "./routes/user.routes.js"




app.use("/api/v1/users", userRouter)
export {app}