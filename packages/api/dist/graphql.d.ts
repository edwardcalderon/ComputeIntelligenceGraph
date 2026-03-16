/**
 * GraphQL API with GraphQL Yoga
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.9, 17.10
 */
import { FastifyInstance } from 'fastify';
declare const pubSub: import("graphql-yoga").PubSub<{
    RESOURCE_UPDATED: [resource: Record<string, unknown>];
    DISCOVERY_PROGRESS: [progress: Record<string, unknown>];
}>;
export { pubSub };
export declare const yoga: import("graphql-yoga").YogaServerInstance<{}, {}>;
export declare function registerGraphQL(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=graphql.d.ts.map