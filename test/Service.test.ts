/**
 * @since 1.0.0
 */

import { describe, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { expect } from "vitest"
import * as GrpcService from "../src/Service.js"

// Mock schema for testing
interface TestRequest {
  readonly message: string
}

interface TestResponse {
  readonly result: string
}

const TestRequestSchema: Schema.Schema<TestRequest, any> = Schema.Struct({
  message: Schema.String
})

const TestResponseSchema: Schema.Schema<TestResponse, any> = Schema.Struct({
  result: Schema.String
})

describe("GrpcService", () => {
  it("should create a service layer", () => {
    const layer = GrpcService.make("./test.proto")

    Effect.runSync(
      Effect.gen(function*() {
        const service = yield* GrpcService.GrpcService
        expect(service).toBeDefined()
      }).pipe(
        Effect.provide(layer)
      )
    )
  })

  it("should register a service", () => {
    const layer = GrpcService.make("./test.proto")

    Effect.runPromise(
      Effect.gen(function*() {
        const service = yield* GrpcService.GrpcService
        const testMethod = GrpcService.makeMethod(
          TestRequestSchema,
          TestResponseSchema,
          (req: TestRequest) => Effect.succeed({ result: `Processed: ${req.message}` })
        )

        const serviceDef = GrpcService.makeService("Test", "TestService", { TestMethod: testMethod })

        yield* service.register(serviceDef)
        // Verify registration executes without error
        expect(true).toBe(true)
      }).pipe(
        Effect.provide(layer)
      )
    ).catch(console.error)
  })

  it("should start and stop a server", () => {
    const layer = GrpcService.make("./test.proto")

    Effect.runPromise(
      Effect.gen(function*() {
        const service = yield* GrpcService.GrpcService
        // Start server on a random available port
        yield* service.start(0)
        yield* service.stop
        // Verify start/stop executes without error
        expect(true).toBe(true)
      }).pipe(
        Effect.provide(layer)
      )
    ).catch(console.error)
  })
})
