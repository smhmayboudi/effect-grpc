/**
 * @since 1.0.0
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Schema from "effect/Schema"

/**
 * @since 1.0.0
 * @category models
 */
// export interface GrpcRouter {
//   readonly _: unique symbol
// }

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcRouteDef<I, O> {
  readonly path: string
  readonly input: Schema.Schema<I, any>
  readonly output: Schema.Schema<O, any>
  readonly handler: (input: I) => Effect.Effect<O, unknown, any>
}

/**
 * @since 1.0.0
 * @category tags
 */
export class GrpcRouter extends Context.Tag("@template/basic/GrpcRouter")<
  GrpcRouter,
  {
    readonly addRoute: <I, O>(
      path: string,
      input: Schema.Schema<I, any>,
      output: Schema.Schema<O, any>,
      handler: (input: I) => Effect.Effect<O, unknown, any>
    ) => Effect.Effect<void>
    readonly handle: Effect.Effect<void>
  }
>() {}

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeRoute = <I, O>(
  path: string,
  input: Schema.Schema<I, any>,
  output: Schema.Schema<O, any>,
  handler: (input: I) => Effect.Effect<O, unknown, any>
): GrpcRouteDef<I, O> => ({
  path,
  input,
  output,
  handler
})

/**
 * @since 1.0.0
 * @category layers
 */
export const make: Layer.Layer<GrpcRouter> = Layer.effect(
  GrpcRouter,
  Effect.sync(() => {
    const routes: Array<GrpcRouteDef<any, any>> = []

    return GrpcRouter.of({
      addRoute: <I, O>(
        path: string,
        input: Schema.Schema<I, unknown>,
        output: Schema.Schema<O, unknown>,
        handler: (input: I) => Effect.Effect<O, unknown, any>
      ) => {
        routes.push({ path, input, output, handler })
        return Effect.succeed(undefined)
      },
      handle: Effect.gen(function*() {
        // This would be where we set up the gRPC server to handle routes
        // In a real implementation, this would connect to the gRPC service
        yield* Effect.log("Router handling gRPC requests")
      })
    })
  })
)

/**
 * @since 1.0.0
 * @category layers
 */
export const makeLive: Layer.Layer<GrpcRouter> = make
