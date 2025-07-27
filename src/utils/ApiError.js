class ApiError extends Error {
    constructor(
        statusCode,
        message= "Somehting went Wrong",
        errors= [],
        
    ) {
        super(message) 
        this.statusCode=statusCode
        this.data = null
        this.message=message
        this.success = false;
        this.errors = errors

       

    }
}

export {ApiError}










// Explaination for readability
// Java Script has a built  in error class but it handles only a few types of errors
// So we make a new class ApiError which inherits the Error class for more funcationality
// inside class there is a constructor function which function runs automatically whenever you create a new object from that class