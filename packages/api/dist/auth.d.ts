import { FastifyRequest, FastifyReply } from 'fastify';
export declare enum Permission {
    READ_RESOURCES = "READ_RESOURCES",
    WRITE_RESOURCES = "WRITE_RESOURCES",
    EXECUTE_ACTIONS = "EXECUTE_ACTIONS",
    MANAGE_DISCOVERY = "MANAGE_DISCOVERY",
    ADMIN = "ADMIN"
}
export interface JwtPayload {
    sub: string;
    permissions: Permission[];
    iat?: number;
    exp?: number;
}
export interface ApiKeyEntry {
    permissions: Permission[];
}
export declare function generateApiKey(permissions?: Permission[]): Promise<{
    key: string;
    hashedKey: string;
}>;
export declare function verifyApiKey(key: string, hashedKey: string): Promise<boolean>;
export declare function generateJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string;
export declare function verifyJwt(token: string): JwtPayload;
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function authorize(requiredPermissions: Permission[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map