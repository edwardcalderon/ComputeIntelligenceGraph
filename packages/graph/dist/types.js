"use strict";
// Graph model types for the Compute Intelligence Graph
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipType = exports.ResourceState = exports.Provider = exports.ResourceType = void 0;
var ResourceType;
(function (ResourceType) {
    ResourceType["COMPUTE"] = "compute";
    ResourceType["STORAGE"] = "storage";
    ResourceType["NETWORK"] = "network";
    ResourceType["DATABASE"] = "database";
    ResourceType["SERVICE"] = "service";
    ResourceType["FUNCTION"] = "function";
    ResourceType["CONTAINER"] = "container";
    ResourceType["VOLUME"] = "volume";
})(ResourceType || (exports.ResourceType = ResourceType = {}));
var Provider;
(function (Provider) {
    Provider["AWS"] = "aws";
    Provider["GCP"] = "gcp";
    Provider["KUBERNETES"] = "kubernetes";
    Provider["DOCKER"] = "docker";
})(Provider || (exports.Provider = Provider = {}));
var ResourceState;
(function (ResourceState) {
    ResourceState["RUNNING"] = "running";
    ResourceState["STOPPED"] = "stopped";
    ResourceState["TERMINATED"] = "terminated";
    ResourceState["ACTIVE"] = "active";
    ResourceState["INACTIVE"] = "inactive";
    ResourceState["PENDING"] = "pending";
    ResourceState["FAILED"] = "failed";
})(ResourceState || (exports.ResourceState = ResourceState = {}));
var RelationshipType;
(function (RelationshipType) {
    RelationshipType["DEPENDS_ON"] = "DEPENDS_ON";
    RelationshipType["CONNECTS_TO"] = "CONNECTS_TO";
    RelationshipType["USES"] = "USES";
    RelationshipType["MEMBER_OF"] = "MEMBER_OF";
    RelationshipType["HAS_PERMISSION"] = "HAS_PERMISSION";
    RelationshipType["MOUNTS"] = "MOUNTS";
    RelationshipType["ROUTES_TO"] = "ROUTES_TO";
})(RelationshipType || (exports.RelationshipType = RelationshipType = {}));
//# sourceMappingURL=types.js.map