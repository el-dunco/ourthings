/** @module Queue */
import Define from './Define.js';


/**
 * @classdesc
 *
 * The main queue class
 *
 * @author Richard Reynolds richard@nautoguide.com
 *
 * @example
 * // queue = new Queue();
 *
 */
export default class Queue {

	/**
	 * Class constructor
	 */
	constructor() {

		self = this;


		/*
		 * Create our DEFINE object for
		 * @type {Define}
		 */
		self.DEFINE = new Define();
		/*
		 * Our Queue array
		 *
		 * @type {Array}
		 */
		self.queue = [];

		/*
		 * Templates to be loaded
		 * @type {Array}
		 */
		self.templates = [];


		/*
		 * Create a fragment for big dom inserts
		 * @type {DocumentFragment}
		 */
		self.fragment = document.createDocumentFragment();

		/*
		 * Se our status
		 * @type {number}
		 */
		self.status = self.DEFINE.STATUS_LOADING;

		/*
		 * Our queue process ID
		 * @type {number}
		 */
		self.pid = 0;

		/*
		 * Default time for process to be executed after
		 * TODO Platform test / tune
		 * @type {number}
		 */
		self.defaultTimer = 10;


		console.clear();
		console.info(self.DEFINE.CONSOLE_LINE);
		console.info('ourthings framework https://github.com/nautoguide/ourthings');

		/*
		 * Run init against all our queueables
		 *
		 * This basically passes the queue object (self) though but also for any queueables that require it
		 * starts any promise functions that will result in them becoming active
		 */
		console.log("[Queueables]");
		for (let i in window.queueables) {
			window.queueables[i].init(self);
			console.log('-'+i);
		}

		/*
		 * Initialise the memory
		 */
		window.memory={};
		/*
		 * Load the templates.json
		 */
		fetch('templates.json', {
			headers: {
				'Content-Type': 'application/json'
			}
		})
			.then(response => self.handleFetchErrors(response))
			.then(response => response.json() )
			.then(function (response) {
				/**
				 * Convert the response to json and start the loader
				 */
				self.templates = response;
				self.templateLoader();
			})
			.catch(function (error) {
				console.info(self.DEFINE.CONSOLE_LINE);
				console.error('Error:', error);
				console.info("Warning this error is probably fatal as I have no templates to load")
			});
	}

	/**
	 * Error Handler for fetch calls
	 * @param response {object} - Fetch response object
	 * @returns {Object}
	 */
	handleFetchErrors(response) {
		if (!response.ok) {
			self.status=self.DEFINE.STATUS_ERROR;
			throw Error(response.statusText);
		}
		return response;
	}

	/**
	 * Loads templates from the template stack. Recursively calls self until stack is empty
	 * @returns {void}
	 */
	templateLoader() {
		let self=this;
		/*
		 *  Are there any templates to load?
		 *
		 *  If not then we dump the fragment into the dom
		 */
		if (this.templates.length === 0) {
			document.head.appendChild(self.fragment);
			// Clean up the fragment
			self.fragment=document.createDocumentFragment();
			/*
			 * Set our status and then process the init template
			 */
			self.status=self.DEFINE.STATUS_LOADED;
			/*
			 *  TODO once queue generation is working this this pushing to the queue
			 *  As currently this is a chain of promises and so everything will error trap back to the loader
			 */
			self.templateProcessor("#init",false);
			self.status=self.DEFINE.STATUS_RUNNING;
			console.info(self.DEFINE.CONSOLE_LINE);
			console.log('[Online]');
			console.log('queue.show(); # To debug the queue');
			return;
		}

		/*
		 * Pop the template off the stack
		 */
		let template = this.templates.pop();

		fetch(template, {
			headers: {
				'Content-Type': 'test/html'
			}
		})
			.then(response => self.handleFetchErrors(response))
			.then(response => response.text())
			.then(function (response) {

				/*
				 * Get the template we were sent and add it to the fragment for insertion into the dom
				 *
				 * We wrap it in meta tag, this helps improve render speed but still stuck with an innerHTML
				 * as we don't know the content
				 *
				 */
				let text = response;
				let meta = document.createElement('meta');
				meta.setAttribute("name", "generator");
				meta.setAttribute("content", template);
				meta.innerHTML=text;
				self.fragment.appendChild(meta);

				/*
				 *  Call our self again to process any more templates
				 */
				self.templateLoader();
			})
			.catch(function (error) {
				console.error('Error:', error);
				console.info("Warning this error is probably fatal as a template specified in templates.json has failed to load or wont process");
			});
	};

	/**
	 * Template processor
	 * Takes a template, process it and places into the dom
	 * @param templateId {string} - ID of the template
	 * @param targetId {string|false} - Place in the dom the put the result. In the event of false we process without dom
	 * @return {boolean} - success status
	 */
	templateProcessor(templateId, targetId) {
		let self=this;
		let commands=[];

		let templateDom = self.getElement(templateId);
		if(!templateDom) {
			self.reportError('No valid template','I have no valid template, check the templateId ['+templateId+']');
			return false;
		}
		let targetDom=undefined;
		let templateHTML = templateDom.innerHTML;
		/*
		 * Pass to the templateParse to build our commands
		 */
		let parsedTemplate=self.templateParse(templateHTML,commands);

		/*
		 * Now we pass any var tags {{ }}
		 */
		parsedTemplate=self.templateVars(parsedTemplate);


		if(targetId!==false) {
			targetDom=self.getElement(targetId);
			if(!targetDom) {
				self.reportError('No valid target','I have no valid target to render the template to, check the targetId ['+targetId+']');
				return false;
			}
			self.renderToDom(targetDom,parsedTemplate);
			self.commandsBind(commands);
		}
		return true;
	}

	/**
	 * Process the template looking for {{}} instances
	 * @param template
	 * @return {*}
	 */
	templateVars(template) {
		const forRegex=/{{#for (.*?)}}([\s\S]*?){{\/for}}/;
		let match=undefined;
		while (match = forRegex.exec(template)) {
			let subTemplate='';
			for(let i in eval(match[1])) {
				let incrementMatch=match[2].replace(/#loop0/,i);
				subTemplate+=self.templateVars(incrementMatch);
			}
			template = template.replace(match[0], subTemplate);
		}

		const commandRegex=/{{(.*?)}}/;
		while (match = commandRegex.exec(template)) {
			template = template.replace(match[0], self.varsParser(match[1]));
		}
		return template;
	}

	/**
	 * parse a var string
	 *
	 * TODO This is massively insecure. If as user can input {{}} into a form and have it displayed
	 * to other users they can take over. We either clean all input as you would with <script> etc tags or we
	 * manually write a parser.
	 *
	 * @param parseString
	 * @return {any}
	 */
	varsParser(parseString) {
		return eval(parseString);
	}

	/**
	 * Takes a template and runs any template commands contained in it to create a HTML template
	 * ready to be put into the dom
	 *
	 * @param template {string}
	 * @return {string}
	 */
	templateParse(template,commands) {
		let commandRegex=/[@\-](.*?\);)/;
		let match=undefined;
		let parentCommand;
		let isParent;
		/*
		 *  Locate all the commands in the template and generate an array of command objects that
		 *  are linked by a reference into the template
		 */
		while (match = commandRegex.exec(template)) {
			isParent=match[0][0]==='@';
			/*
			 * Generate this command object from the extracted string
			 */
			let command=self.commandParse(match[1],isParent);

			/*
			 *  In the case of an instant or sub run we don't need to leave anything in the DOM so nuke
			 */
			if(command.options.queueRun===self.DEFINE.COMMAND_INSTANT||command.options.queueRun===self.DEFINE.COMMAND_SUB) {
				template = template.replace(match[0], "");
			} else {
				template = template.replace(match[0], "data-queueable=\"CMD" + commands.length + "\"");
			}
			/*
			 *  Is this a @parent or a -child?
			 */
			if(isParent) {
				// Set the parent point to current position
				parentCommand=commands.length;
				/*
				 *  Is this an event (in which case we need to bind events later). We know this use case because an
				 *  event will not be instant and it will be a parent
				 */
				if(command.options.queueRun!==self.DEFINE.COMMAND_INSTANT) {
					/*
					 *  We need to re-extract the command from the template and find the HTML element that this
					 *  belongs to
					 *
					 *  TODO Stub for now as we need to get a working queue first
					 */
					//let elementMatch=template.match(//)
				}

				commands.push(command);
			} else {
				// If the parent has just been created it won't have child structure
				if(commands[parentCommand].commands===undefined) {
					commands[parentCommand].commands=[];
				}
				// Put the command in the parents
				commands[parentCommand].commands.push(command);
			}
		}
		// Add the instants to the active queue
		self.commandsQueue(commands);
		return template;
	}

	/**
	 * Bind the events to the dom based on the command Object
	 * @param commandObj
	 */
	commandsBind(commandObj) {
		let self=this;
		for(let command in commandObj) {
			/*
			 * Bind queue elements will not me marked to run instantly so we pick those
			 */
			if(commandObj[command].options.queueRun!==self.DEFINE.COMMAND_INSTANT) {
				/*
				 * Find its dom entry using the selector we added
				 */
				let element=self.getElement("[data-queueable=CMD"+command+"]");

				/*
				 * Add the event. We flip it over to an instant event now because we want
				 * it triggered.
				 */
				element.addEventListener("click", function(){
					commandObj[command].options.queueRun=self.DEFINE.COMMAND_INSTANT;
					self.commandsQueue.apply(self,[[commandObj[command]]]);
				});
			}
		}

	}

	/**
	 * Take the commands array with command objects in it and add them to the queue *if* they are
	 * marked as instant. IE ready to execute
	 *
	 * @param commandObj
	 */
	commandsQueue(commandObj) {
		let self=this;
		for(let command in commandObj) {
			if(commandObj[command].options.queueRun===self.DEFINE.COMMAND_INSTANT) {
				let dereference=self.deepCopy(commandObj[command])
				self.queue.push(dereference);
			}
		}
		/*
		 *  Trigger a queue process
		 */
		self.queueProcess();
	}

	/**
	 * Force a queue processing
	 *
	 * This launches the actual objects using a timeout
	 */
	queueProcess() {
		let self=this;
		/*
		 *  TODO Only implementing basic queue here for testing. Concepts of active componets etc need importing
		 *  for moho
		 */
		for(let item in self.queue) {
			/*
			 *  Look for items that are QUEUE_ADDED as they need processing
			 *
			 *  Ensure the component is online
			 */
			if(self.queue[item].state===self.DEFINE.QUEUE_ADDED&&window.queueables[self.queue[item].queueable].ready) {
				/*
				 * Update our state to be running
				 */
				self.queue[item].state=self.DEFINE.QUEUE_RUNNING;
				/*
				 * Assign a pid
				 */
				if(self.queue[item].pid===undefined) {
					self.queue[item].pid = self.pid;
					self.pid++;
				}
				/*
				 * Check if any specific timing is needed
				 */
				self.queue[item].options.queueTimer=self.queue[item].options.queueTimer||self.defaultTimer;

				/*
				 *  Launch the function as a time out (so we get control back)
				 */

				setTimeout(function () {
					window.queueables[self.queue[item].queueable].start.apply(window.queueables[self.queue[item].queueable],[self.queue[item].pid,self.queue[item].command,self.queue[item].json,self]);
				}, self.queue[item].options.queueTimer);
			}
		}
	}

	/**
	 * Find a queue item by searching for its PID
	 * @param pid
	 * @return {*}
	 */
	findQueueByPid(pid) {
		for(let item in self.queue) {
			if(self.queue[item].pid===pid) {
				return self.queue[item];
			}
		}
		return false;
	}

	/**
	 * Called by queueables to add something to our memory stack
	 * @param name
	 * @param value
	 * @param pid
	 */
	memory(pid,value,name) {
		let self=this;
		let command=this.findQueueByPid(pid);
		if(command) {
			let origin = name || command.queueable + '.' + command.command;
			let mode = self.DEFINE.MEMORY_GARBAGE;
			if (command.options.memory)
				mode = command.options.memory;
			let memoryDetails = {
				pid: pid,
				mode: mode,
				origin: origin,
				value: value
			};
			window.memory[origin] = memoryDetails;
			return true;
		} else {
			this.reportError("Could not set memory","The memory set for pid ["+pid+"] could not be found");
			return false;
		}
	}

	cleanMemory(pid) {
		let self=this;
		for(let i in window.memory) {
			if(window.memory[i].pid===pid&&window.memory[i].mode===self.DEFINE.MEMORY_GARBAGE) {
				window.memory[i]={};
				delete window.memory[i];
			}
		}

	}

	/**
	 *  Called to flag a queue item as finished
	 *
	 *  Normally hooked down from queueable this is a queue item saying I have finished in mode (see define.js)
	 *
	 * @param pid
	 * @param mode
	 */
	finished(pid,mode,error) {
		let self=this;
		for(let item in self.queue) {
			/*
			 *  Find the queue item we need to finish
			 */
			if(self.queue[item].pid===pid) {
				self.queue[item].error=error;
				if (self.queue[item].state === self.DEFINE.QUEUE_RUNNING) {
					/*
					 * Did the command return an error? If so we will stop this queue from further execution
					 */
					if(mode==self.DEFINE.FIN_ERROR) {
						self.queue[item].state=self.DEFINE.QUEUE_ERROR;
						self.reportError(error,'The queueable ['+pid+'] has errored, queue put on hold');
						return;
					}
					/*
					 * Was there a warning?. This isn't serious so we just mention it to the console
					 */
					if(mode==self.DEFINE.FIN_WARNING) {
						console.log('Warning: '+error);
					}
						/*
						 *
						 * Check if this queue has commands left
						 */
					if(self.queue[item].commands!==undefined&&self.queue[item].commands.length>0) {
						/*
						 * Move the next item in the queue down
						 */
						self.queue[item].command=self.queue[item].commands[0].command;
						self.queue[item].queueable=self.queue[item].commands[0].queueable;
						self.queue[item].json=self.queue[item].commands[0].json;
						self.queue[item].options=self.queue[item].commands[0].options;
						self.queue[item].commands.shift();
						/*
						 *  Update the pid
						 *  TODO remove this as queues need to maintain their Pid for memory
						 */
						//self.queue[item].pid=self.pid;
						//self.pid++;
						self.queue[item].state = self.DEFINE.QUEUE_ADDED;
						/*
						 * Start the queue processor as we just posted a new command
						 */
						self.queueProcess();
					} else {
						self.queue[item].state = self.DEFINE.QUEUE_FINISHED;
						self.cleanMemory(self.queue[item].pid);
					}
					return;
				} else {
					self.reportError('Cant stop an already stopped process ['+pid+']','Queue is corrupted');
					return;
				}
			}
		}
	}

	/**
	 * This will take a command string in the format object.command({},{}); and split it down
	 * into it parts as an object
	 *
	 * TODO no concept of the context of the command IE was it from inside a div that need binding?
	 * @param command {string}
	 * @return {object}
	 */
	commandParse(command,isParent) {
		let self=this;
		let commandObject={};
		// Find the actual command
		let commandArray=command.match(/(.*?)\(/)[1].split('.');
		commandObject.queueable=commandArray[0];
		commandObject.command=commandArray[1];
		// Strip as we go to make follow up regex easier
		command=command.replace(/.*?\(/,'');
		// Find first json arg
		let json=command.match(/(\{.*?\})/);
		command=command.replace(/\{.*?\}[,]{0,1}/,'');
		if(command[1]) {
			commandObject.json = JSON.parse(json[1]);
		} else {
			commandObject.json={};
		}

		// Find second json arg
		let jsonOptions=command.match(/(\{.*?\})/);
		if(Array.isArray(jsonOptions) && jsonOptions[1]) {
			commandObject.options = JSON.parse(jsonOptions[1]);
		} else {
			commandObject.options={};
		}
		/*
		 * Set our default options if they haven't been set
		 *
		 * We must always have a queueRun object if its not set (normally by instant) then its either an event in
		 * which case it must be a parent or failing then its a sub
		 *
 		 */
		commandObject.options.queueRun=commandObject.options.queueRun||(isParent? self.DEFINE.COMMAND_EVENT:self.DEFINE.COMMAND_SUB);
		commandObject.state=self.DEFINE.QUEUE_ADDED;
		return commandObject;
	}

	/**
	 * Render some text/html to the dom
	 * @param domObject {object} - The object in the dom to write to
	 * @param text {string} - The text/HTML to write
	 * @param mode {number} - Mode to use while writing see define.js
	 * @return {boolean}
	 */
	renderToDom(domObject,text,mode) {
		let self=this;
		mode=mode||self.DEFINE.RENDER_INSERT;
		switch(mode) {
			case self.DEFINE.RENDER_INSERT:
				domObject.innerHTML=text;
				break;
		}
		return true;
	}

	/**
	 * Finds an element in the dom using the jquery formant IE #id .class tag
	 * @param elementTarget
	 * @return {object|false}
	 */
	getElement(elementTarget) {
		let self=this;
		let element=document.querySelector(elementTarget);
		if(element!==null)
			return element;
		self.reportError('Dom Element find failed for ['+elementTarget+']','Follow up calls that rely on this will fail');
		return false;
	}

	/**
	 *  Show current queue status in the console DEBUG function
	 */
	show() {
		let self=this;
		for(let i in self.queue) {
			let indent=0;
			self.prettyCommandObject(self.queue[i],indent);
			for(let j in self.queue[i].commands) {
				indent++;
				self.prettyCommandObject(self.queue[i].commands[j],indent);

			}
		}
	}

	/**
	 * Make a pretty version of the currrent commandObject and dump it to the console
	 * @param commandObject
	 * @param indent
	 */
	prettyCommandObject(commandObject,indent) {
		let string='';
		for(var i=0;i<indent;i++) {
			string+=' ';
		}
		let color=self.DEFINE.CONSOLE_COL_GREEN;
		switch(commandObject.state) {
			case self.DEFINE.QUEUE_FINISHED:
				color=self.DEFINE.CONSOLE_COL_AMBER;
				break;
			case self.DEFINE.QUEUE_ERROR:
				color=self.DEFINE.CONSOLE_COL_RED;
				break;

		}
		string+=commandObject.queueable+'.'+commandObject.command+'('+JSON.stringify(commandObject.json)+','+JSON.stringify(commandObject.options)+');'
		console.log('%c '+string,color);
		if(commandObject.error)
			console.log('%c  Stopped: '+commandObject.error,self.DEFINE.CONSOLE_COL_AMBER);
	}

	/**
	 * Report an error to the console, adds various internal stats
	 * @param error
	 * @param message
	 */
	reportError(error,message) {
		console.info(self.DEFINE.CONSOLE_LINE);
		console.error('Error:', error);
		console.info(message);
	}

	/**
	 * Deep copy and object IE remove references
	 * @param inputObject
	 * @return {any}
	 */
	deepCopy(inputObject) {
		return JSON.parse(JSON.stringify(inputObject));
	}

}