import mongoose, {Schema} from "mongoose";

// data of channels and everyone whoever has subscribed 
const subscriptionSchema = new Schema({
    subscriber: {
            type: Schema.Types.ObjectId, // one who is subscribing
            ref:"User"
        },
    channel: {
        type: Schema.Types.ObjectId, // one to whom the subcriber is subscribing
        ref:"User"
    },
    
     
    

}, { timestamps:true })



export const Subscription = mongoose.model("Subscription", subscriptionSchema)