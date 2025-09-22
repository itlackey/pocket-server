<script>
	import { onMount } from 'svelte';

	let ws = null;
	let sessionId = null;
	let terminalId = null;
	let connectionStatus = 'Disconnected';
	let sessionInfo = 'No session';
	let command = '';
	let output = 'No output yet...';
	let messages = [];

	function log(message) {
		console.log(message);
		messages = [...messages, `${new Date().toLocaleTimeString()}: ${message}`];
	}

	function sendMessage(type, payload = {}) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			log('WebSocket not connected');
			return false;
		}

		const message = {
			v: 1,
			id: crypto.randomUUID(),
			sessionId: sessionId || 'test-session',
			ts: new Date().toISOString(),
			timestamp: Date.now(),
			type: type,
			payload: payload
		};

		log(`Sending: ${type}`);
		ws.send(JSON.stringify(message));
		return true;
	}

	function connect() {
		log('Connecting to WebSocket...');
		ws = new WebSocket('ws://localhost:3000/ws');

		ws.onopen = () => {
			log('WebSocket connected');
			connectionStatus = 'Connected';
		};

		ws.onmessage = (event) => {
			const message = JSON.parse(event.data);
			log(`Received: ${message.type}`);

			if (message.type === 'term:opened') {
				terminalId = message.payload.id;
				sessionInfo = `Session created: ${terminalId}`;
			} else if (message.type === 'term:frame') {
				output += message.payload.data;
			} else if (message.type === 'term:error') {
				log(`Terminal error: ${message.payload.error}`);
			}
		};

		ws.onclose = () => {
			log('WebSocket disconnected');
			connectionStatus = 'Disconnected';
		};

		ws.onerror = (error) => {
			log(`WebSocket error: ${error}`);
		};
	}

	function disconnect() {
		if (ws) {
			ws.close();
			ws = null;
		}
		connectionStatus = 'Disconnected';
	}

	function createSession() {
		sessionId = crypto.randomUUID();
		terminalId = crypto.randomUUID();

		sendMessage('term:open', {
			id: terminalId,
			cwd: '/tmp',
			cols: 80,
			rows: 24
		});
	}

	function sendCommand() {
		if (!command.trim() || !terminalId) return;

		output += `$ ${command}\n`;

		sendMessage('term:input', {
			id: terminalId,
			data: command + '\n',
			seq: Date.now()
		});

		command = '';
	}

	function handleKeypress(e) {
		if (e.key === 'Enter') {
			sendCommand();
		}
	}
</script>

<svelte:head>
	<title>Terminal WebSocket Test</title>
</svelte:head>

<div style="font-family: Arial, sans-serif; margin: 20px;">
	<h1>WebSocket Terminal Test</h1>

	<div style="border: 2px solid #ccc; padding: 20px; margin: 10px 0;">
		<h2>WebSocket Connection</h2>
		<button onclick={connect} disabled={connectionStatus === 'Connected'}>Connect WebSocket</button>
		<button onclick={disconnect} disabled={connectionStatus === 'Disconnected'}>Disconnect</button>
		<div style="color: {connectionStatus === 'Connected' ? 'green' : 'red'}">{connectionStatus}</div>
	</div>

	<div style="border: 2px solid #ccc; padding: 20px; margin: 10px 0;">
		<h2>Terminal Session</h2>
		<button onclick={createSession} disabled={connectionStatus === 'Disconnected'}>Create Terminal Session</button>
		<div>{sessionInfo}</div>
	</div>

	<div style="border: 2px solid #ccc; padding: 20px; margin: 10px 0;">
		<h2>Command Execution</h2>
		<input
			type="text"
			bind:value={command}
			onkeypress={handleKeypress}
			placeholder="Enter command"
			style="padding: 5px; margin: 5px;"
		/>
		<button onclick={sendCommand} disabled={!terminalId || !command.trim()}>Send Command</button>
		<div style="background: #000; color: #00ff00; padding: 10px; font-family: monospace; white-space: pre-wrap; min-height: 100px;">
			{output}
		</div>
	</div>

	<div style="border: 2px solid #ccc; padding: 20px; margin: 10px 0;">
		<h2>WebSocket Messages</h2>
		<div style="max-height: 200px; overflow-y: auto; background: #f5f5f5; padding: 10px;">
			{#each messages as message}
				<div>{message}</div>
			{/each}
		</div>
	</div>
</div>