/*
 * onScan.js - scan-events for hardware barcodes scanners in javascript
 */
;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory()) :
    global.onScan = factory()
}(this, (function () {
	var onScan = {	
		
		/**
		 * 
		 * @param DomElement oDomElement
		 * @param Object oOptions
		 * @return self
		 */
		attachTo: function(oDomElement, oOptions) {
	
			if (oDomElement.scannerDetectionData !== undefined) {
				console.log('onScan.js is already initialized for DOM element', oDomElement);
				return;
			}
	
			var oDefaults = {
				onScan: function(sScanned, iQty){}, // Callback after detection of a successful scanning:  function(){sScancode, iCount)}()
				onScanError: function(oDebug){}, // Callback after detection of an unsuccessful scanning (scanned string in parameter)
				onKeyProcess: function(sChar, oEvent){}, // Callback after receiving and processing a char (scanned char in parameter)
				onKeyDetect: function(iKeyCode, oEvent){}, // Callback after detecting a keyDown (key char in parameter) - in contrast to onKeyProcess, this fires for non-character keys like tab, arrows, etc. too!
				onPaste: function(sPasted, oEvent){}, // Callback after receiving a value on paste, no matter if it is a valid code or not
				keyCodeMapper: function(oEvent) {return onScan.decodeKeyEvent(oEvent)}, // Custom function to decode a keydown event into a character. Must return decoded character or NULL if the given event should not be processed.
				onScanButtonLongPress: function(){}, // Callback after detection of a successful scan while the scan button was pressed and held down
				scanButtonKeyCode:false, // Key code of the scanner hardware button (if the scanner button acts as a key itself) 
				scanButtonLongPressTime:500, // How long (ms) the hardware button should be pressed, until a callback gets executed
				timeBeforeScanTest:100, // Wait duration (ms) after keypress event to check if scanning is finished
				avgTimeByChar:30, // Average time (ms) between 2 chars. Used to differentiate between keyboard typing and scanning
				minLength:6, // Minimum length for a scanning
				suffixKeyCodes:[9,13], // Chars to remove and means end of scanning
				prefixKeyCodes:[], // Chars to remove and means start of scanning
				ignoreIfFocusOn:false, // do not handle scans if the currently focused element matches this selector or object
				stopPropagation:false, // Stop immediate propagation on keypress event
				preventDefault:false, // Prevent default action on keypress event
				captureEvents:false, // Get the events before any listeners deeper in the DOM
				reactToKeydown:true, // look for scan input in keyboard events [ TODO: will not be used ]
				reactToPaste:false, // look for scan input in paste events
				singleScanQty: 1, // Quantity of Items put out to onScan in a single scan
				useKeypressOverKeyDown: false, // to use keypress instead of keydown
				validators: [], // array of functions to validate the input
				unlockCountDown: 5000, // time to wait before resetting the in process scan
			};

			oOptions = this._mergeOptions(oDefaults, oOptions);
	
			// initializing options and variables on DomElement
			oDomElement.scannerDetectionData = {
				options: oOptions,
				vars:{
					firstCharTime: 0,
					lastCharTime: 0,
					accumulatedString: '',
					testTimer: false,
					longPressTimeStart: 0,
					longPressed: false,
					isCurrentlyProcessing: false,
					isCurrentlyProcessingTimeout: null,
				}

			};
			
			// initializing handlers (based on settings)
			if (oOptions.reactToPaste === true){
				oDomElement.addEventListener("paste", this._handlePaste, oOptions.captureEvents);
			}
			if (oOptions.scanButtonKeyCode !== false){
				oDomElement.addEventListener("keyup", this._handleKeyUp, oOptions.captureEvents);
			}
			if (!oOptions.useKeypressOverKeyDown === true || oOptions.scanButtonKeyCode !== false){
				oDomElement.addEventListener("keydown", this._handleKeyEvent, oOptions.captureEvents);
			}

			if (oOptions.useKeypressOverKeyDown) {
				oDomElement.addEventListener('keypress', this._handleKeyEvent, oOptions.captureEvents);
			}

			return this;
		},

		initAndListenToScans: function (oDomElement, oOptions) {
			return this.attachTo(oDomElement, oOptions);
		},

		/**
		 *
		 * @param DomElement oDomElement
		 * @return void
		 */
		detachFrom: function(oDomElement) {
			// detaching all used events
			if (oDomElement.scannerDetectionData.options.reactToPaste){
				oDomElement.removeEventListener("paste", this._handlePaste, oDomElement.scannerDetectionData.options.captureEvents);
			}

			if (oDomElement.scannerDetectionData.options.scanButtonKeyCode !== false){
				oDomElement.removeEventListener("keyup", this._handleKeyUp, oDomElement.scannerDetectionData.options.captureEvents);
			}

			if (oDomElement.scannerDetectionData.options.useKeypressOverKeyDown) {
				oDomElement.removeEventListener('keypress', this._handleKeyEvent, oDomElement.scannerDetectionData.options.captureEvents);
			}

			if (!oDomElement.scannerDetectionData.options.useKeypressOverKeyDown) {
				oDomElement.removeEventListener('keydown', this._handleKeyEvent, oDomElement.scannerDetectionData.options.captureEvents);
			}

			// clearing data off DomElement
			oDomElement.scannerDetectionData = undefined;
			return;
		},
		
		/**
		 * 
		 * @param DomElement oDomElement
		 * @return Object
		 */
		getOptions: function(oDomElement){
			return oDomElement.scannerDetectionData.options;			
		},
	
		/**
		 * 
		 * @param DomElement oDomElement
		 * @param Object oOptions
		 * @return self
		 */
		setOptions: function(oDomElement, oOptions){
			// check if some handlers need to be changed based on possible option changes
			switch (oDomElement.scannerDetectionData.options.reactToPaste){
				case true: 
					if (oOptions.reactToPaste === false){
						oDomElement.removeEventListener("paste", this._handlePaste);
					}
					break;
				case false:
					if (oOptions.reactToPaste === true){
						oDomElement.addEventListener("paste", this._handlePaste);
					}
					break;
			}
			
			switch (oDomElement.scannerDetectionData.options.scanButtonKeyCode){
				case false:
					if (oOptions.scanButtonKeyCode !== false){
						oDomElement.addEventListener("keyup", this._handleKeyUp);
					}
					break;
				default: 
					if (oOptions.scanButtonKeyCode === false){
						oDomElement.removeEventListener("keyup", this._handleKeyUp);
					}
					break;
			}
			
			// merge old and new options
			oDomElement.scannerDetectionData.options = this._mergeOptions(oDomElement.scannerDetectionData.options, oOptions);
		
			// reinitiallize
			this._reinitialize(oDomElement);
			return this;
		},
		
		/**
		 * Transforms key codes into characters.
		 * 
		 * By default, only the follwing key codes are taken into account
		 * - 48-90 (letters and regular numbers)
		 * - 96-105 (numeric keypad numbers)
		 * - 106-111 (numeric keypad operations)
		 * 
		 * All other keys will yield empty strings!
		 * 
		 * The above keycodes will be decoded using the KeyboardEvent.key property on modern
		 * browsers. On older browsers the method will fall back to String.fromCharCode()
		 * putting the result to upper/lower case depending on KeyboardEvent.shiftKey if
		 * it is set.
		 * 
		 * @param KeyboardEvent oEvent
		 * @return string
		 */
		decodeKeyEvent : function (oEvent) {
			var iCode = this._getNormalizedKeyNum(oEvent);
			switch (true) {
				case iCode >= 48 && iCode <= 90: // numbers and letters
				case iCode >= 106 && iCode <= 111: // operations on numeric keypad (+, -, etc.)
					if (oEvent.key !== undefined && oEvent.key !== '') {
						return oEvent.key;
					}
				
					var sDecoded = String.fromCharCode(iCode);
					switch (oEvent.shiftKey) {
						case false: sDecoded = sDecoded.toLowerCase(); break;
						case true: sDecoded = sDecoded.toUpperCase(); break;
					}
					return sDecoded;
				case iCode >= 96 && iCode <= 105: // numbers on numeric keypad
					return 0+(iCode-96);
			}
			return '';
		},
		
		/**
		 * Simulates a scan of the provided string code. by dispatching custom events
		 * @return self
		 * @param oDomElement
		 * @param string
		 * @param dispatchEnterSuffix
		 */
		bypassAndSimulateScan(oDomElement, string, dispatchEnterSuffix = false) {
			this._reinitialize(oDomElement);
			for (let i = 0; i < string.length; i++) {
				const key = string[i];
				this.dispatchCustomKeyEvent(
					oDomElement,
					{
						key,
						code: key.charCodeAt(0),
						keyCode: key.charCodeAt(0),
						which: key.charCodeAt(0),
					},
					{ bypassOnscan: true },
				);
			}

			if (dispatchEnterSuffix) {
				this.dispatchCustomKeyEvent(oDomElement, {
					key: 'Enter',
					code: 'Enter',
					charCode: 13,
					keyCode: 13,
					which: 13,
				}, { bypassOnscan: true });
			}

			return this;
		},

		dispatchCustomKeyEvent(oDomElement, eventDict, customProperty) {
			if (typeof CustomKeyEvent === 'undefined') {
				return;
			}

			const oScannerData = oDomElement.scannerDetectionData;
			const oOptions = oScannerData.options;
			const eventType = oOptions.useKeypressOverKeyDown ? 'keypress' : 'keydown';
			// Create an instance of the custom event
			const event = new CustomKeyEvent(eventType, customProperty, {
				...eventDict,
				bubbles: true,
				cancelable: true,
				composed: true,
				view: window,
			});

			// Dispatch the event on the document object
			oDomElement.dispatchEvent(event);
		},

		disableScans(oDomElement) {
			const oVars = oDomElement.scannerDetectionData.vars;
			oVars.isCurrentlyProcessing = true;
			onScan.autoEnableScansAfterCountdown(oDomElement);
		},

		autoEnableScansAfterCountdown(oDomElement) {
			const oOptions = oDomElement.scannerDetectionData.options;
			const oVars = oDomElement.scannerDetectionData.vars;

			oVars.isCurrentlyProcessingTimeout = setTimeout(
				onScan.enableScans,
				oOptions.unlockCountDown,
				oDomElement,
			);
		},

		enableScans(oDomElement) {
			const oVars = oDomElement.scannerDetectionData.vars;
			oVars.isCurrentlyProcessing = false;
			clearTimeout(oDomElement.scannerDetectionData.vars.isCurrentlyProcessingTimeout);
		},

		/**
		 * @private
		 * @param DomElement oDomElement
		 * @return void
		 */
		_reinitialize: function(oDomElement){
			var oVars = oDomElement.scannerDetectionData.vars;
			oVars.firstCharTime = 0;
			oVars.lastCharTime = 0;
			oVars.accumulatedString = '';
			return;
		},
		
		/**
		 * @private
		 * @param DomElement oDomElement
	     * @return boolean
		 */
		_isFocusOnIgnoredElement: function(oDomElement){
			
			var ignoreSelectors = oDomElement.scannerDetectionData.options.ignoreIfFocusOn;
	
	        if(!ignoreSelectors){
				return false;
			}
		
			var oFocused = document.activeElement;
			
			// checks if ignored element is an array, and if so it checks if one of the elements of it is an active one
			if (Array.isArray(ignoreSelectors)){
				for(var i=0; i<ignoreSelectors.length; i++){
					if(oFocused.matches(ignoreSelectors[i]) === true){
						return true;
					}
				}
			// if the option consists of an single element, it only checks this one
			} else if (oFocused.matches(ignoreSelectors)){
				return true;					
			}
			
			// if the active element is not listed in the ignoreIfFocusOn option, return false
			return false;
		},

		/**
		 * Validates if the event target is an ignored element.
		 * @param oDomElement
		 * @param event
		 * @returns {boolean}
		 * @private
		 */
		_isEventTargetIgnoredElement: function (oDomElement, event) {
			var ignoreSelectors = oDomElement.scannerDetectionData.options.ignoreIfFocusOn;

			if (!ignoreSelectors) {
				return false;
			}

			const oFocused = event.target;

			// checks if ignored element is an array, and if so it checks if one of the elements of it is an active one
			if (Array.isArray(ignoreSelectors)) {
				for (var i = 0; i < ignoreSelectors.length; i++) {
					if (oFocused.matches(ignoreSelectors[i]) === true) {
						return true;
					}
				}
				// if the option consists of an single element, it only checks this one
			} else if (oFocused.matches(ignoreSelectors)) {
				return true;
			}

			// if the active element is not listed in the ignoreIfFocusOn option, return false
			return false;
		},

		/**
		 * This function runs the validators on the scan code.
		 * @private
		 * @param sScanCode
		 * @param iFirstCharTime
		 * @param iLastCharTime
		 * @param oOptions
		 * @private
		 */
		_runValidators: async function (oDomElement, sScanCode) {
			const oScannerData = oDomElement.scannerDetectionData;
			const oOptions = oScannerData.options;
			const vars = oScannerData.vars;
			const iFirstCharTime = oScannerData.vars.firstCharTime;
			const iLastCharTime = oScannerData.vars.lastCharTime;

			const validationSteps = [
				{
					validate: () => sScanCode.length >= oOptions.minLength,
					errorMessage: `Scanned value can't be shorter than ${oOptions.minLength} characters.`,
					shouldTriggerEnter: false,
				},
				{
					validate: () => (iLastCharTime - iFirstCharTime)
						<= (sScanCode.length * oOptions.avgTimeByChar),
					errorMessage: 'Scanned value is entered too slowly.',
					shouldTriggerEnter: false,
				},
				{
					validate: () => vars.isCurrentlyProcessing === false,
					errorMessage: 'A currently scanned value is still being processed.',
					shouldTriggerEnter: false,
					shouldPassScanToPage: false,
				},
			];

			for (const step of validationSteps) {
				if (!step.validate()) {
					return {
						isValid: false,
						error: step.errorMessage,
						shouldTriggerEnterEvent: step.shouldTriggerEnter,
						shouldPassScanToPage: step.shouldPassScanToPage,
					};
				}
			}

			// Check custom validators
			for (const validator of oOptions.validators) {
				if (typeof validator !== 'function') {
					sendErrorToLR('Validator is not a function', {
						validator,
						options: oOptions,
					});
					continue;
				}

				const isValid = await validator(sScanCode);
				if (!isValid) {
					return {
						isValid,
						error: `Scanned value has failed ${validator.name} validation`,
					};
				}
			}

			return { isValid: true };
		},

		/**
		 * Validates the scan code accumulated
		 * by the given DOM element and fires the respective events.
		 * @private
		 * @param DomElement oDomElement
		 * @return boolean
		 */
		_validateScanCode: async function(oDomElement, sScanCode){
			const oScannerData = oDomElement.scannerDetectionData;
			const oOptions = oScannerData.options;
			const iSingleScanQty = oScannerData.options.singleScanQty;
			const iFirstCharTime = oScannerData.vars.firstCharTime;
			const iLastCharTime = oScannerData.vars.lastCharTime;

			const {
				isValid,
				error,
				shouldTriggerEnterEvent = true,
				shouldPassScanToPage = true,
			} = await onScan._runValidators(oDomElement, sScanCode);

			if (isValid) {
				oOptions.onScan.call(oDomElement, sScanCode, iSingleScanQty);
				onScan._reinitialize(oDomElement);
				return true;
			}

			const oScanError = {
				message: error,
				scanCode: sScanCode,
				scanDuration: iLastCharTime - iFirstCharTime,
				avgTimeByChar: oOptions.avgTimeByChar,
				minLength: oOptions.minLength,
			};

			oOptions.onScanError.call(oDomElement, oScanError);
			if (shouldPassScanToPage) {
				onScan.bypassAndSimulateScan(oDomElement, sScanCode, shouldTriggerEnterEvent);
			}
			onScan._reinitialize(oDomElement);
			return false;
		},

		/**
		 * @private
		 * @param Object oDefaults
		 * @param Object oOptions
		 * @return Object
		 */
		_mergeOptions: function(oDefaults, oOptions){
			var oExtended = {};
			var prop;
			for (prop in oDefaults){
				if (Object.prototype.hasOwnProperty.call(oDefaults, prop)){
					oExtended[prop] = oDefaults[prop];
				}
			}			
			for (prop in oOptions){
				if (Object.prototype.hasOwnProperty.call(oOptions, prop)){
					oExtended[prop] = oOptions[prop];
				}
			}			
			return oExtended;
		},
	
		/**
		 * @private
		 * @param KeyboardEvent e
		 * @return int
		 * @see https://www.w3schools.com/jsref/event_key_keycode.asp
		 */
		_getNormalizedKeyNum: function(e){
			return e.which || e.keyCode;
		},
	
	
		/**
		 * @private
		 * @param KeyboardEvent e
		 * @return void
		 */
		_handleKeyEvent: async function(e){
			var iKeyCode = onScan._getNormalizedKeyNum(e);
			var oOptions = this.scannerDetectionData.options;
			var oVars = this.scannerDetectionData.vars;
			var bScanFinished = false;
			
			if (oOptions.onKeyDetect.call(this, iKeyCode, e) === false) {
				return;
			}

			if (onScan._isFocusOnIgnoredElement(this)
				|| onScan._isEventTargetIgnoredElement(this, e)) {
				return;
			}

			// If it's just the button of the scanner, ignore it and wait for the real input
			if (oOptions.scanButtonKeyCode !== false && iKeyCode == oOptions.scanButtonKeyCode) {

				// if the button was first pressed, start a timeout for the callback, which gets interrupted if the scanbutton gets released
				if (!oVars.longPressed) {
					oVars.longPressTimer = setTimeout(
						oOptions.onScanButtonLongPress,
						oOptions.scanButtonLongPressTime,
						this,
					);
					oVars.longPressed = true;
				}

				return;
			}

			switch (true) {
				// If it's not the first character and we encounter a terminating character, trigger scan process
				case (oVars.firstCharTime && oOptions.suffixKeyCodes.indexOf(iKeyCode) !== -1):
					e.preventDefault();
					e.stopImmediatePropagation();
					bScanFinished=true;
					break;
					
				// If it's the first character and we encountered one of the starting characters, don't process the scan	
				case (!oVars.firstCharTime && oOptions.prefixKeyCodes.indexOf(iKeyCode)!==-1):
					e.preventDefault();
					e.stopImmediatePropagation();
					bScanFinished=false;
					break;
					
				// Otherwise, just add the character to the scan string we're building	
				default:
					if (e instanceof CustomKeyEvent && e.bypassOnscan) {
						// move to web page and do not process
						return;
					}

					var character = '';
					if (e.type === 'keypress') {
						/**
						 *  if the key is a any key with length > 1, return an empty string because
						 *  it's not a character it's a special key like tab, enter, etc.
						 */
						character = e.key.length === 1 ? e.key : null;
					} else if (e.type === 'keydown') {
						character = oOptions.keyCodeMapper.call(this, e);
					}

					if (character === null) {
						return;
					}
					oVars.accumulatedString += character;
					
					if (oOptions.preventDefault) {
						e.preventDefault();
					}
					if (oOptions.stopPropagation) {
						e.stopImmediatePropagation();
					}
					
					bScanFinished=false;
					break;
			}
	        
			if(!oVars.firstCharTime){
				oVars.firstCharTime=Date.now();
			}
			
			oVars.lastCharTime=Date.now();
	
			if(oVars.testTimer){ 
				clearTimeout(oVars.testTimer);
			}
			
			if(bScanFinished){
				await onScan._validateScanCode(this, oVars.accumulatedString);
				oVars.testTimer=false;
			} else {
				oVars.testTimer=setTimeout(onScan._validateScanCode, oOptions.timeBeforeScanTest, this, oVars.accumulatedString);
			}
	
			oOptions.onKeyProcess.call(this, character, e);
			return;
		},
		
		/**
		 * @private
		 * @param Event e
		 * @return void
		 */
		_handlePaste: async function(e){
	
			var oOptions = this.scannerDetectionData.options;
			var oVars = this.scannerDetectionData.vars;
			var sPasteString = (event.clipboardData || window.clipboardData).getData('text');
			
			// if the focus is on an ignored element, abort
			if (onScan._isFocusOnIgnoredElement(this)
				|| onScan._isEventTargetIgnoredElement(this, e)) {
				return;
			}
			
			e.preventDefault();

			if (oOptions.stopPropagation) {
				e.stopImmediatePropagation();
			}
						
			oOptions.onPaste.call(this, sPasteString, event);
			
			oVars.firstCharTime = 0;
			oVars.lastCharTime = 0;
			
			// validate the string
			await onScan._validateScanCode(this, sPasteString);
			return;
		},
		
		/**
		 * @private
		 * @param KeyboardEvent e
		 * @return void
		 */
		_handleKeyUp: function(e){
			// if the focus is on an ignored element, abort
			if (onScan._isFocusOnIgnoredElement(this)
				|| onScan._isEventTargetIgnoredElement(this, e)) {
				return;
			}
			
			var iKeyCode = onScan._getNormalizedKeyNum(e);
			
			// if hardware key is not being pressed anymore stop the timeout and reset
			if (iKeyCode == this.scannerDetectionData.options.scanButtonKeyCode){
				clearTimeout(this.scannerDetectionData.vars.longPressTimer);
				this.scannerDetectionData.vars.longPressed = false;
			}
			return;
		},
		
		/**
		 * Returns TRUE if the scanner is currently in the middle of a scan sequence.
		 * 
		 * @param DomElement
		 * @return boolean
		 */
		isScanInProgressFor: function(oDomElement) {
			return oDomElement.scannerDetectionData.vars.firstCharTime > 0;
		},
		
		/**
		 * Returns TRUE if onScan is attached to the given DOM element and FALSE otherwise.
		 * 
		 * @param DomElement
		 * @return boolean
		 */
		isAttachedTo: function(oDomElement) {
			return (oDomElement.scannerDetectionData !== undefined);
		}
	};
	
	return onScan;
})));
