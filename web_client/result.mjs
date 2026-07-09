export class Result {
  constructor(isSuccess, value, error, stack) {
    /** @readonly */
    this.isSuccess = isSuccess;
    /** @readonly */
    this.isFailure = !isSuccess;
    
    // Internal backing properties
    this.value = value;
    this.error = error;
    this._stack = stack; // Use a private backing property to avoid colliding with the getter
  }

  /**
   * Factory method for a successful result.
   * @template T
   * @param {T} value 
   * @returns {Result<T, never>}
   */
  static ok(value = "thisValueShouldNeverBeSeenAndIfItIsThere'sAnError") {
      if(value ==  "thisValueShouldNeverBeSeenAndIfItIsThere'sAnError"){
        return new Result(true, "thisValueShouldNeverBeSeenAndIfItIsThere'sAnError", null, new Error().stack);
      }
      console.log("Result.ok(", value, ")");
      // Also fixed a bug here where it returned "no value given" instead of the value
      return new Result(true, value, null, new Error().stack);
  }

  /**
   * Factory method for a failed result.
   * @template E
   * @param {E} error 
   * @returns {Result<never, E>}
   */
  static err(error = null) {
    // Capture the stack trace from the exact line Result.err() was called
    if (error != null) {
      console.warn("Result.err(", error, ")\n", new Error().stack);
    }
    const stack = new Error().stack;
    return new Result(false, null, error, stack);
  }

  /**
   * Exposes the captured stack trace if it's a failure, otherwise null.
   * @returns {string|null}
   */
  get stack() {
    return this._stack; // Read from the private backing property
  }

  /**
   * Returns the value if successful, or throws a fallback error if failed.
   * Automatically prints the observation point stack trace to the console upon failure.
   * @returns {T}
   */
  unwrap() {
    if (this.isFailure) {
      // Print the observation point stack trace automatically
      console.error(`[Result Error Observed] Original Error:`, this.error);
      console.error(`[Result Error Stack Trace]:\n${this.stack}`);
      
      // Throw the standard unwrap error to halt execution as expected
      throw new Error(`Tried to unwrap an Err result: ${this.error}`);
    }
    return this.value;
  }

  /**
   * Transforms the inner value if the result is Ok.
   * @template U
   * @param {(value: T) => U} mapper 
   * @returns {Result<U, E>}
   */
  map(mapper) {
    if (this.isFailure) {
      // Propagate the original error and its stack trace
      return new Result(false, null, this.error, this._stack);
    }
    return Result.ok(mapper(this.value));
  }
}
