// @ts-check

/**
 * @file user_password_auth.js
 * @description SOCKS5 Subnegotiation Username/Password Authentication Handler (RFC 1929) for Node.js
 */

const { Duplex } = require('node:stream');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Server callback for verifying credentials.
 * @callback AuthCallback
 * @param {string} user Decoded username string.
 * @param {string} pass Decoded password string.
 * @param {(success: boolean) => void} done Callback function to indicate whether authentication succeeded.
 * @returns {void}
 */

/**
 * Completion callback for the server handler.
 * @callback ServerCompletionCallback
 * @param {Error | boolean} errOrSuccess Error instance on failure, or boolean status.
 * @returns {void}
 */

/**
 * Completion callback for the client handler.
 * @callback ClientCompletionCallback
 * @param {boolean | Error} success True if server accepted credentials, false/Error otherwise.
 * @returns {void}
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/** @enum {number} */
const ServerState = Object.freeze({
	VERSION: 0,
	ULEN: 1,
	UNAME: 2,
	PLEN: 3,
	PASSWD: 4
});

/** @enum {number} */
const ClientState = Object.freeze({
	VERSION: 0,
	STATUS: 1
});

const BUF_SUCCESS = Buffer.from([0x01, 0x00]);
const BUF_FAILURE = Buffer.from([0x01, 0x01]);

// ============================================================================
// CLASS IMPLEMENTATION
// ============================================================================

class UserPasswordAuthHandler
{
	/**
	 * Constructs a SOCKS5 User/Password Auth Handler instance.
	 * @param {AuthCallback | string} authCbOrUser AuthCallback function (for server mode) or username string (for client mode).
	 * @param {string} [password] Password string (required for client mode).
	 */
	constructor(authCbOrUser, password)
	{
		/** @type {number} */
		this.METHOD = 0x02;

		/** @type {AuthCallback | undefined} */
		this.authCallback = undefined;

		/** @type {string | undefined} */
		this.username = undefined;

		/** @type {string | undefined} */
		this.password = undefined;

		/** @type {number} */
		this.userLen = 0;

		/** @type {number} */
		this.passLen = 0;

		if(typeof authCbOrUser === 'function')
		{
			this.authCallback = authCbOrUser;
		} else if(typeof authCbOrUser === 'string' && typeof password === 'string')
		{
			this.username = authCbOrUser;
			this.password = password;
			this.userLen = Buffer.byteLength(this.username);
			this.passLen = Buffer.byteLength(this.password);

			if(this.userLen > 255)
			{
				throw new Error('Username too long (limited to 255 bytes)');
			}
			if(this.passLen > 255)
			{
				throw new Error('Password too long (limited to 255 bytes)');
			}
		} else
		{
			throw new Error('Invalid arguments provided to UserPasswordAuthHandler constructor');
		}
	}

	/**
	 * Handles SOCKS5 Subnegotiation Username/Password Auth on the Server (RFC 1929)
	 * @param {Duplex} stream Inbound client stream socket.
	 * @param {ServerCompletionCallback} cb Callback invoked upon subnegotiation finish.
	 * @returns {void}
	 */
	server(stream, cb)
	{
		if(!this.authCallback)
		{
			throw new Error('Server handler invoked without an auth callback');
		}

		/** @type {ServerState} */
		let state = ServerState.VERSION;
		let userBuffer = Buffer.alloc(0);
		let passBuffer = Buffer.alloc(0);
		let userPos = 0;
		let passPos = 0;
		let usernameStr = '';

		/**
		 * @param {Buffer} chunk
		 */
		const onData = (chunk) =>
		{
			let i = 0;
			const len = chunk.length;

			while(i < len)
			{
				switch(state)
				{
					/*
					  +----+------+----------+------+----------+
					  |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
					  +----+------+----------+------+----------+
					  | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
					  +----+------+----------+------+----------+
					*/
					case ServerState.VERSION: {
						if(chunk[i] !== 0x01)
						{
							stream.removeListener('data', onData);
							return cb(new Error(`Unsupported auth request version: ${chunk[i]}`));
						}
						i++;
						state = ServerState.ULEN;
						break;
					}

					case ServerState.ULEN: {
						const ulen = chunk[i];
						if(ulen === 0)
						{
							stream.removeListener('data', onData);
							return cb(new Error('Bad username length (0)'));
						}
						i++;
						state = ServerState.UNAME;
						userBuffer = Buffer.alloc(ulen);
						userPos = 0;
						break;
					}

					case ServerState.UNAME: {
						const remainingTarget = userBuffer.length - userPos;
						const remainingChunk = len - i;
						const bytesToCopy = Math.min(remainingTarget, remainingChunk);

						chunk.copy(userBuffer, userPos, i, i + bytesToCopy);
						userPos += bytesToCopy;
						i += bytesToCopy;

						if(userPos === userBuffer.length)
						{
							usernameStr = userBuffer.toString('utf8');
							state = ServerState.PLEN;
						}
						break;
					}

					case ServerState.PLEN: {
						const plen = chunk[i];
						if(plen === 0)
						{
							stream.removeListener('data', onData);
							return cb(new Error('Bad password length (0)'));
						}
						i++;
						state = ServerState.PASSWD;
						passBuffer = Buffer.alloc(plen);
						passPos = 0;
						break;
					}

					case ServerState.PASSWD: {
						const remainingTarget = passBuffer.length - passPos;
						const remainingChunk = len - i;
						const bytesToCopy = Math.min(remainingTarget, remainingChunk);

						chunk.copy(passBuffer, passPos, i, i + bytesToCopy);
						passPos += bytesToCopy;
						i += bytesToCopy;

						if(passPos === passBuffer.length)
						{
							stream.removeListener('data', onData);
							const passwordStr = passBuffer.toString('utf8');
							state = ServerState.VERSION;

							if(i < len)
							{
								stream.unshift(chunk.subarray(i));
							}

              /** @type {AuthCallback} */ (this.authCallback)(usernameStr, passwordStr, (success) =>
							{
								if(stream.writable)
								{
									stream.write(success ? BUF_SUCCESS : BUF_FAILURE);
									cb(success);
								}
							});
							return;
						}
						break;
					}
				}
			}
		};

		stream.on('data', onData);
	}

	/**
	 * Handles SOCKS5 Subnegotiation Username/Password Auth on the Client (RFC 1929)
	 * @param {Duplex} stream Outbound server stream socket.
	 * @param {ClientCompletionCallback} cb Callback invoked with auth result.
	 * @returns {void}
	 */
	client(stream, cb)
	{
		if(this.username === undefined || this.password === undefined)
		{
			throw new Error('Client handler invoked without credentials');
		}

		/** @type {ClientState} */
		let state = ClientState.VERSION;

		/**
		 * @param {Buffer} chunk
		 */
		const onData = (chunk) =>
		{
			let i = 0;
			const len = chunk.length;

			while(i < len)
			{
				switch(state)
				{
					/*
					  +----+--------+
					  |VER | STATUS |
					  +----+--------+
					  | 1  |   1    |
					  +----+--------+
					*/
					case ClientState.VERSION: {
						if(chunk[i] !== 0x01)
						{
							stream.removeListener('data', onData);
							return cb(new Error(`Unsupported auth request version: ${chunk[i]}`));
						}
						i++;
						state = ClientState.STATUS;
						break;
					}

					case ClientState.STATUS: {
						const status = chunk[i];
						i++;
						state = ClientState.VERSION;

						if(i < len)
						{
							stream.unshift(chunk.subarray(i));
						}

						stream.removeListener('data', onData);
						return cb(status === 0);
					}
				}
			}
		};

		stream.on('data', onData);

		// Build subnegotiation request buffer
		const buf = Buffer.alloc(3 + this.userLen + this.passLen);
		buf[0] = 0x01; // Version
		buf[1] = this.userLen;
		buf.write(this.username, 2, this.userLen, 'utf8');
		buf[2 + this.userLen] = this.passLen;
		buf.write(this.password, 3 + this.userLen, this.passLen, 'utf8');

		stream.write(buf);
	}
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Factory function export for backward compatibility with traditional function signatures.
 * @param {AuthCallback | string} authCbOrUser
 * @param {string} [password]
 * @returns {UserPasswordAuthHandler}
 */
function UserPasswordAuthHandlers(authCbOrUser, password)
{
	return new UserPasswordAuthHandler(authCbOrUser, password);
}

UserPasswordAuthHandlers.UserPasswordAuthHandler = UserPasswordAuthHandler;

module.exports = UserPasswordAuthHandlers;
