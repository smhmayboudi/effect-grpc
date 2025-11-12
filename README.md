# @effect/grpc

Effect-based gRPC transport layer similar to `@effect/rpc`.

## Overview

This library provides a gRPC transport layer built with the Effect ecosystem, following the same patterns as `@effect/rpc`. It allows you to define gRPC services and clients using Effect's type-safe, functional approach.

## Features

- Type-safe gRPC services and clients using Effect patterns
- Built-in schema validation with `effect/Schema`
- Service definition using Effect services
- Client abstraction with proper error handling
- Layer-based dependency management

## Installation

```bash
npm install @effect/grpc
```

## Usage

### Server Example

```typescript
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as GrpcService from "@effect/grpc/Service"
import * as GrpcRouter from "@effect/grpc/Router"

// Define schemas
interface HelloRequest {
  readonly name: string
}

interface HelloReply {
  readonly message: string
}

const HelloRequestSchema = Schema.Struct({
  name: Schema.String
})

const HelloReplySchema = Schema.Struct({
  message: Schema.String
})

// Define service handler
const sayHelloHandler = (request: HelloRequest) => 
  Effect.succeed<HelloReply>({ message: `Hello, ${request.name}!` })

// Create and start server
const runServer = Effect.gen(function*() {
  const service = yield* GrpcService.GrpcService
  
  yield* service.register(
    GrpcService.makeService("Greeter", {
      SayHello: GrpcService.makeMethod(
        HelloRequestSchema,
        HelloReplySchema,
        sayHelloHandler
      )
    })
  )
  
  yield* service.start(50051)
  console.log("gRPC server running on port 50051")
  
  yield* Effect.never
})
```

### Client Example

```typescript
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as GrpcClient from "@effect/grpc/Client"
import * as GrpcTransport from "@effect/grpc/Transport"

// Define schemas (same as server)
const HelloRequestSchema = Schema.Struct({
  name: Schema.String
})

const HelloReplySchema = Schema.Struct({
  message: Schema.String
})

// Create client method
const sayHelloMethod = GrpcClient.makeMethod(
  "/example.Greeter/SayHello",
  HelloRequestSchema,
  HelloReplySchema
)

// Make client call
const result = yield* Effect.gen(function*() {
  const client = yield* GrpcClient.GrpcClient
  return yield* client.call(sayHelloMethod, { name: "World" })
})
```

## API

### Transport

- `GrpcTransport`: Service for making gRPC calls
- `make(config)`: Create a transport layer
- `makeLive(config)`: Create a live transport layer

### Client

- `GrpcClient`: Service for making client calls
- `makeMethod(path, input, output)`: Create a client method definition

### Service

- `GrpcService`: Service for defining gRPC servers
- `makeMethod(input, output, handler)`: Create a service method
- `makeService(name, methods)`: Create a gRPC service

### Router

- `GrpcRouter`: Service for routing gRPC requests
- `makeRoute(path, input, output, handler)`: Create a route definition

## License

MIT