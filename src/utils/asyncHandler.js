const asyncHandler=(requestHandler)=> {
    return (req,res,next)=> {
        Promise.resolve(requestHandler(req,res,next)).
        catch((err)=> next(err))
    }

}  

// Func inside a function to catch errors
export {asyncHandler}