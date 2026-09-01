import { Result } from "./result.mjs";

export class ProtobufManager {
    constructor(protoDefinition) {
        this.protoDefinition = protoDefinition;
        this.root = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            protobuf.parse(this.protoDefinition, (err, root) => {
                if (err) return reject(err);
                this.root = root;
                resolve();
            });
        });
    }

    serialize(messageTypeName, payload) {
        const type = this.root.lookupType(messageTypeName);
        return type.encode(type.create(payload)).finish();
    }

    deserialize(messageTypeName, buffer) {
        const type = this.root.lookupType(messageTypeName);
        return type.decode(new Uint8Array(buffer));
    }
}

export class SocketManager {
    socket = null;
    #protoManager = null;
    #mapping = {
        open: null,
        close: null,
        send: null,
        message: null,
        err: null
    };

    constructor(newMapping = {}, schema = null) {
        this.#mapping = { ...this.#mapping, ...newMapping };
        if (schema) {
            this.#protoManager = new ProtobufManager(schema);
        }
    }

    async Init() {
        if (this.#protoManager) await this.#protoManager.init();
        return Result.ok();
    }

	/**
	 * @param {string} url - The WebSocket server URL
	 * @param {Object} details - Object containing { ip, serviceName, description }
	 * @param {any} openInput - Data to pass to the open callback
	 */
	async Connect(url, details = {}, openInput = null) {
	    if (!window.cockatiel) return Result.err("Cockatiel UI not initialized");

	    // Construct a rich description for the modal/toast
	    const connectionDescription = `
		<strong>Service:</strong> ${details.serviceName || "Unknown"}<br>
		<strong>IP/Host:</strong> ${details.ip || url}<br>
		<small>${details.description || "Attempting to establish connection..."}</small>
	    `;

	    const choice = await window.cockatiel.CreateModal({
		title: "Connection Request",
		description: connectionDescription, // Now shows details
		yesPrompt: "Allow",
		noPrompt: "Deny"
	    });

        // 2. If user denied or closed, stop here
        if (choice.isFailure || choice.value === false) {
            return Result.err("Connection denied by user.");
        }

        // 3. Proceed with WebSocket setup
        return new Promise((resolve) => {
            try {
                this.socket = new WebSocket(url);
                this.socket.binaryType = "arraybuffer";

                this.socket.onopen = () => {
                    this.#mapping.open?.(openInput);
                    resolve(Result.ok());
                };

                this.socket.onclose = () => {
                    this.#mapping.close?.();
                };

                this.socket.onerror = (e) => {
                    this.#mapping.err?.(e);
                    resolve(Result.err("Socket error occurred."));
                };

                this.socket.onmessage = async (event) => {
                    try {
                        const decoded = this.#protoManager.deserialize("Envelope", event.data);
                        const msgType = Object.keys(decoded.payload)[0]; 
                        const msgData = decoded.payload[msgType];

                        if (this.#mapping[msgType]) {
                            this.#mapping[msgType](msgData);
                        }
                    } catch (err) {
                        this.#mapping.err?.(`Processing failed: ${err.message}`);
                    }
                };
            } catch (e) {
                resolve(Result.err(`Connection error: ${e.message}`));
            }
        });
    }

    /**
     * Sends a protobuf-serialized message.
     */
    Send(messageTypeName, data) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) 
            return Result.err("Socket not connected");

        try {
            const payload = this.#protoManager.serialize(messageTypeName, data);
            this.socket.send(payload);
            return Result.ok();
        } catch (err) {
            return Result.err(`Serialization failed: ${err.message}`);
        }
    }

    /**
     * Updates the callback mapping safely.
     */
    UpdateMapping(newEntries) {
        for (const [key, value] of Object.entries(newEntries)) {
            if (Object.prototype.hasOwnProperty.call(this.#mapping, key)) {
                if (typeof value === 'function' || value === null) {
                    this.#mapping[key] = value;
                } else {
                    console.warn(`[SocketManager] Update failed: '${key}' must be a function.`);
                }
            } else {
                console.warn(`[SocketManager] Update failed: '${key}' is not a valid mapping key.`);
            }
        }
    }
}
