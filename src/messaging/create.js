"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const meta = require("../meta");
const plugins = require("../plugins");
const db = require("../database");
const user = require("../user");
module.exports = function (Messaging) {
    Messaging.sendMessage = (data) => __awaiter(this, void 0, void 0, function* () {
        yield Messaging.checkContent(data.content);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const inRoom = yield Messaging.isUserInRoom(data.uid, data.roomId);
        if (!inRoom) {
            throw new Error('[[error:not-allowed]]');
        }
        return yield Messaging.addMessage(data);
    });
    Messaging.checkContent = (content) => __awaiter(this, void 0, void 0, function* () {
        if (!content) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const maximumChatMessageLength = meta.config.maximumChatMessageLength || 1000;
        content = String(content).trim();
        let { length } = content;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        ({ content, length } = (yield plugins.hooks.fire('filter:messaging.checkContent', { content, length })));
        if (!content) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        if (maximumChatMessageLength && length > maximumChatMessageLength) {
            throw new Error(`[[error:chat-message-too-long, ${maximumChatMessageLength}]]`);
        }
    });
    Messaging.addMessage = (data) => __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const mid = yield db.incrObjectField('global', 'nextMid');
        const timestamp = data.timestamp || Date.now();
        let dataIP = '';
        if (data.ip) {
            dataIP = data.ip;
        }
        let message = {
            content: String(data.content),
            timestamp: timestamp,
            fromuid: data.uid,
            roomId: data.roomId,
            deleted: 0,
            system: data.system || 0,
            ip: dataIP,
        };
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        message = (yield plugins.hooks.fire('filter:messaging.save', message));
        if (mid) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield db.setObject(`message:${mid}`, message);
        }
        const isNewSet = yield Messaging.isNewSet(data.uid, data.roomId, timestamp);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let uids = yield db.getSortedSetRange(`chat:room:${data.roomId}:uids`, 0, -1);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        uids = (yield user.blocks.filterUids(data.uid, uids));
        yield Promise.all([
            Messaging.addRoomToUsers(data.roomId, uids, timestamp),
            Messaging.addMessageToUsers(data.roomId, uids, mid, timestamp),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            Messaging.markUnread(uids.filter(uid => uid !== String(data.uid)), data.roomId),
        ]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const messages = yield Messaging.getMessagesData([mid], data.uid, data.roomId, true);
        if (!messages || !messages[0]) {
            return null;
        }
        messages[0].newSet = isNewSet;
        messages[0].mid = mid;
        messages[0].roomId = data.roomId;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield plugins.hooks.fire('action:messaging.save', { message: messages[0], data: data });
        return messages[0];
    });
    Messaging.addSystemMessage = (content, uid, roomId) => __awaiter(this, void 0, void 0, function* () {
        const message = yield Messaging.addMessage({
            content: content,
            uid: uid,
            roomId: roomId,
            system: 1,
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        Messaging.notifyUsersInRoom(uid, roomId, message);
    });
    Messaging.addRoomToUsers = (roomId, uids, timestamp) => __awaiter(this, void 0, void 0, function* () {
        if (!uids.length) {
            return;
        }
        const keys = uids.map(uid => `uid:${uid}:chat:rooms`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.sortedSetsAdd(keys, timestamp, roomId);
    });
    Messaging.addMessageToUsers = (roomId, uids, mid, timestamp) => __awaiter(this, void 0, void 0, function* () {
        if (!uids.length) {
            return;
        }
        const keys = uids.map(uid => `uid:${uid}:chat:room:${roomId}:mids`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.sortedSetsAdd(keys, timestamp, mid);
    });
};
