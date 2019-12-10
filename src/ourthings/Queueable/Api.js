/** @module Api */
import Queueable from "../Queueable";

/**
 * @classdesc
 *
 * API connection methods
 *
 * @author Richard Reynolds richard@nautoguide.com
 *
 * @example
 * //
 *
 */
export default class Api extends Queueable {

	/**
	 * Make a GET request
	 *
	 * @param {number} pid - Process ID
	 * @param {object} json - queue arguments
	 * @param {string} json.url - URL to make GET request to
	 * @param {string} json.contentType=application/json - Content type to request
	 * @param {string} json.header - header object to send (note Content-Type is overwritten by above setting)
	 * @param {string} json.name - name of error queue to use
	 */
	get(pid,json) {
		let self=this;
		json.contentType=json.contentType||'application/json';
		json.name=json.name||'apiError';
		let headers=json.headers||{};
		headers['Content-Type']=json.contentType||'application/json';
		fetch(json.url, {
			headers: headers,
		})
			.then(function(response) {
				if (!response.ok) {
					self.queue.setMemory('apiErrorDetail',{"json":json,"error":response},self.queue.DEFINE.MEMORY_SESSION);
					self.queue.execute(json.name);
				}
				self.queue.handleFetchErrors(response);
				return response;
			})
			.then(function(response) {
				switch(json.contentType) {
					case 'application/json':
						return response.json();
					default:
						return response.text();
				}
			})
			.then(function (response) {
				/*
				 * Convert the response to json and start the loader
				 */
				self.set(pid,response);
				self.finished(pid,self.queue.DEFINE.FIN_OK);

			})
			.catch(function (error) {
				self.queue.setMemory('apiErrorDetail',{"json":json,"error":error},self.queue.DEFINE.MEMORY_SESSION);
				self.queue.execute(json.name);
				console.info(self.queue.DEFINE.CONSOLE_LINE);
				console.error('Error:', error);
				console.info("api.get Warning this error is probably fatal");
			});

	}

	/**
	 * Make a POST request
	 *
	 * @param {number} pid - Process ID
	 * @param {object} json - queue arguments
	 * @param {string} json.url - URL to make GET request to
	 * @param {string} json.contentType=application/json - Content type to request
	 * @param {string} json.header - header object to send (note Content-Type is overwritten by above setting)
	 * @param {string} json.body - object to send JSON.stringify is applies to this
	 * @param {string} json.name - name of error queue to use
	 */
	post(pid,json) {
		let self=this;
		json.contentType=json.contentType||'application/json';
		json.name=json.name||'apiError';
		let headers=json.headers||{};
		headers['Content-Type']=json.contentType||'application/json';
		fetch(json.url, {
			headers: headers,
			method: 'POST',
			body: JSON.stringify(json.body)
		})
			.then(function(response) {
				if (!response.ok) {
					self.queue.setMemory('apiErrorDetail',{"json":json,"error":response},self.queue.DEFINE.MEMORY_SESSION);
					self.queue.execute(json.name);
				}
				self.queue.handleFetchErrors(response);
				return response;
			})
			.then(function(response) {
				switch(json.contentType) {
					case 'application/json':
						return response.json();
					default:
						return response.text();
				}
			})
			.then(function (response) {
				/*
				 * Convert the response to json and start the loader
				 */
				self.set(pid,response);
				self.finished(pid,self.queue.DEFINE.FIN_OK);

			})
			.catch(function (error) {
				self.queue.setMemory('apiErrorDetail',{"json":json,"error":error},self.queue.DEFINE.MEMORY_SESSION);
				self.queue.execute(json.name);
				console.info(self.queue.DEFINE.CONSOLE_LINE);
				console.error('Error:', error);
				console.info("api.post Warning this error is probably fatal");
			});

	}

	/**
	 * Make a PUT request
	 *
	 * @param {number} pid - Process ID
	 * @param {object} json - queue arguments
	 * @param {string} json.url - URL to make PUT request to
	 * @param {string} json.contentType=application/json - Content type to request
	 * @param {string} json.header - header object to send (note Content-Type is overwritten by above setting)
	 * @param {string} json.body - object to send JSON.stringify is applies to this
	 * @param {string} json.name - name of error queue to use
	 */
	put(pid,json) {
		let self=this;
		json.contentType=json.contentType||'image/png';
		json.name=json.name||'apiError';
		let headers=json.headers||{};
		headers['Content-Type']=json.contentType;
		fetch(json.url, {
			headers: headers,
			method: 'PUT',
			body: window.atob(json.body)
		})
			.then(function(response) {
				if (!response.ok) {
					self.queue.setMemory('apiErrorDetail',{"json":json,"error":response},self.queue.DEFINE.MEMORY_SESSION);
					self.queue.execute(json.name);
				}
				self.queue.handleFetchErrors(response);
				return response;
			})
			.then(function(response) {
				switch(json.contentType) {
					case 'application/json':
						return response.json();
					default:
						return response.text();
				}
			})
			.then(function (response) {
				/*
				 * Convert the response to json and start the loader
				 */
				self.set(pid,response);
				self.finished(pid,self.queue.DEFINE.FIN_OK);

			})
			.catch(function (error) {
				self.queue.setMemory('apiErrorDetail',{"json":json,"error":error},self.queue.DEFINE.MEMORY_SESSION);
				self.queue.execute(json.name);
				console.info(self.queue.DEFINE.CONSOLE_LINE);
				console.error('Error:', error);
				console.info("api.put Warning this error is probably fatal");
			});

	}

	/**
	 * Create a new websocket
	 *
	 * @param {number} pid - Process ID
	 * @param {object} json - queue arguments
	 * @param {string} json.url - URL to connect websocket too
	 * @param {string} json.action - What json param will contain the 'action' router
	 * @param {string} json.queues - Array of {action:"action", queue:"queue" }

	 */
	websocketInit(pid,json) {
		let self=this;
		let options=Object.assign({
			"url":"ws://localhost",
			"action":"action",
			"queues":{}
		},json);
		self.socket = new WebSocket(options.url);
		self.socket.onopen = function(event) {
			self.finished(pid,self.queue.DEFINE.FIN_OK);
		};
		self.socket.onmessage = function(event) {
			let stack=[];
			let jsonData=JSON.parse(event.data);
			if(memory[`wsStack_${jsonData[options.action]}`])
				stack=memory[`wsStack_${jsonData[options.action]}`].value;
			stack.push(jsonData);
			self.queue.setMemory(`wsStack_${jsonData[options.action]}`,stack,self.queue.DEFINE.MEMORY_SESSION);
			for(let i in options.queues) {
				if(jsonData[options.action]===options.queues[i].action) {
					self.queue.execute(options.queues[i].queue);
				}

			}
		};
	}

	websocketPop(pid,json) {
		this.set(pid,memory[`wsStack_${json.action}`].value.pop());
		console.log(memory);
		this.finished(pid,self.queue.DEFINE.FIN_OK);
	}

	/**
	 * Send a json message down the websocket
	 *
	 * @param {number} pid - Process ID
	 * @param {object} json - queue arguments
	 * @param {string} json.message - JSON message to send
	 */
	websocketSend(pid,json) {
		let self=this;
		self.socket.send(JSON.stringify(json.message));
		self.finished(pid,self.queue.DEFINE.FIN_OK);
	}

}
