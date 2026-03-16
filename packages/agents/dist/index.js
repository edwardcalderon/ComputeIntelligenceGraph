"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawAgent = exports.ConversationContext = void 0;
var openclaw_1 = require("./openclaw");
Object.defineProperty(exports, "ConversationContext", { enumerable: true, get: function () { return openclaw_1.ConversationContext; } });
Object.defineProperty(exports, "OpenClawAgent", { enumerable: true, get: function () { return openclaw_1.OpenClawAgent; } });
__exportStar(require("./openfang"), exports);
//# sourceMappingURL=index.js.map