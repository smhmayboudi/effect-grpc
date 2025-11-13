/**
 * @since 1.0.0
 */

import { Context, Effect, Layer, type Schema } from "effect"

/**
 * @since 1.0.0
 * @category type ids
 */
export const GrpcRouteDefTypeId = Symbol.for("@template/basic/GrpcRouteDef")
export type GrpcRouteDefTypeId = typeof GrpcRouteDefTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcRouteDef<I, O> {
  readonly [GrpcRouteDefTypeId]: GrpcRouteDefTypeId
  readonly path: string
  readonly input: Schema.Schema<I, any>
  readonly output: Schema.Schema<O, any>
  readonly handler: (input: I) => Effect.Effect<O, any, any>
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
      handler: (input: I) => Effect.Effect<O, any, any>
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
  handler: (input: I) => Effect.Effect<O, any, any>
): GrpcRouteDef<I, O> => ({
  [GrpcRouteDefTypeId]: GrpcRouteDefTypeId,
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
        input: Schema.Schema<I, any>,
        output: Schema.Schema<O, any>,
        handler: (input: I) => Effect.Effect<O, any, any>
      ) => {
        routes.push({ [GrpcRouteDefTypeId]: GrpcRouteDefTypeId, path, input, output, handler })

        return Effect.void
      },
      handle: Effect.gen(function*() {
        // This would be where we set up the gRPC server to handle routes
        // In a real implementation, this would connect to the gRPC service
        yield* Effect.log("Router handling gRPC requests")
      })
    })
  })
)
