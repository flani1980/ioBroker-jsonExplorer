"use strict";

let stateAttr = {};
let adapter; //adapter-object initialized by init(); other functions do not need adapter-object in their signatur

/**
 * @param {object} adapter Adapter-Class (normally "this")
 * @param {object} stateAttr check README
 */
function init(adapterOrigin, stateAttribute) {
	adapter = adapterOrigin;
	adapter.createdStatesDetails = {};
	stateAttr = stateAttribute;
}

/**
 * Traeverses the json-object and provides all information for creating/updating states
 * @param {object} jObjectValues Json-object to be added as states
 */
function TraverseJson(jObjectValues, site) {
	let value = null;
	let jsonId = "";

	try {
		for (const i in jObjectValues) {
			jsonId = i;
			adapter.log.debug(`Write state '${jsonId}' with value '${jObjectValues[i]}' and type '${typeof (jObjectValues[i])}'`);
			if(Array.isArray(jObjectValues[i])){
				value = jObjectValues[i][0];
			}else{
				value = jObjectValues[i];
			}

			//avoid state creation if empty
			if (value != "[]") {
				stateSetCreate(site, jsonId, value);
			}
		}
	} catch (error) {
		const eMsg = `Error in function TraverseJson(): ${error}`;
		adapter.log.error(eMsg);
		console.error(eMsg);
	}
}

/**
 * Analysis modify element in stateAttr.js and executes command
 * @param {string} method defines the method to be executed (e.g. round())
 * @param {string | number} value value to be executed
*/
function modify(method, value) {
	adapter.log.debug(`Function modify with method "${method}" and value "${value}"`);
	let result = null;
	try {
		if (method.match(/^custom:/gi) != null) {                               //check if starts with "custom:"
			value = eval(method.replace(/^custom:/gi, ""));                     //get value without "custom:"
		} else if (method.match(/^multiply\(/gi) != null) {                     //check if starts with "multiply("
			const inBracket = parseFloat(method.match(/(?<=\()(.*?)(?=\))/g));    //get value in brackets
			value = parseFloat(value) * inBracket;
		} else if (method.match(/^divide\(/gi) != null) {                       //check if starts with "divide("
			const inBracket = parseFloat(method.match(/(?<=\()(.*?)(?=\))/g));    //get value in brackets
			value = parseFloat(value) / inBracket;
		} else if (method.match(/^round\(/gi) != null) {                        //check if starts with "round("
			const inBracket = parseInt(method.match(/(?<=\()(.*?)(?=\))/g));      //get value in brackets
			value = Math.round(parseFloat(value) * Math.pow(10, inBracket)) / Math.pow(10, inBracket);
		} else if (method.match(/^add\(/gi) != null) {                          //check if starts with "add("
			const inBracket = parseFloat(method.match(/(?<=\()(.*?)(?=\))/g));    //get value in brackets
			value = parseFloat(value) + inBracket;
		} else if (method.match(/^substract\(/gi) != null) {                    //check if starts with "substract("
			const inBracket = parseFloat(method.match(/(?<=\()(.*?)(?=\))/g));    //get value in brackets
			value = parseFloat(value) - inBracket;
		}
		else {
			const methodUC = method.toUpperCase();
			switch (methodUC) {
				case "UPPERCASE":
					if (typeof value == "string") result = value.toUpperCase();
					break;
				case "LOWERCASE":
					if (typeof value == "string") result = value.toLowerCase();
					break;
				case "UCFIRST":
					if (typeof value == "string") result = value.substring(0, 1).toUpperCase() + value.substring(1).toLowerCase();
					break;
				default:
					result = value;
			}
		}
		if (!result) return value;
		return result;
	} catch (error) {
		const eMsg = `Error in function modify for method ${method} and value ${value}: ${error}`;
		adapter.log.error(eMsg);
		console.error(eMsg);
		return value;
	}
}

function getStateAttrKeys() {
	return Object.keys(stateAttr);
}

function buildObjectId(stateAttrValue, siteObj){
	let result = siteObj.Name + ".";
	if (stateAttrValue.parent !== undefined){
		result = result + stateAttrValue.parent + ".";
	}
	result = result + stateAttrValue.name;
	return result;
}

/**
 * Function to handle state creation
 * proper object definitions
 * rounding of values
 * @param {string} siteObj siteObj
 * @param {string} name Name of state (also used for stattAttrlib!)
 * @param {any} value Value of the state
 * @param {number} expire expire time in seconds; default is no expire
 */
async function stateSetCreate(siteObj, name, value, expire = 0) {
	adapter.log.debug(`Create_state called for '${name}' with value '${value}'`);
	try {
		// Try to get details from state lib, if not use defaults. throw warning is states is not known in attribute list
		const common = {};
		common.modify = {};
		if (!stateAttr[name]) {
			const newWarnMessage = `State attribute definition missing for '${name}' with value '${value}' and type of value '${typeof (value)}'`;
			adapter.log.error(newWarnMessage);
			return;
		}
		common.name = stateAttr[name] !== undefined ? stateAttr[name].name || name : name;
		common.type = stateAttr[name] !== undefined ? stateAttr[name].type || typeof (value) : typeof (value);
		common.role = stateAttr[name] !== undefined ? stateAttr[name].role || "state" : "state";
		common.read = true;
		common.unit = stateAttr[name] !== undefined ? stateAttr[name].unit || "" : "";
		common.write = stateAttr[name] !== undefined ? stateAttr[name].write || false : false;
		common.states = stateAttr[name] !== undefined ? stateAttr[name].states || "" : "";
		common.modify = stateAttr[name] !== undefined ? stateAttr[name].modify || "" : "";
		adapter.log.debug(`MODIFY to ${name}: ${JSON.stringify(common.modify)}`);

		const objName = buildObjectId(stateAttr[name], siteObj);

		if ((!adapter.createdStatesDetails[objName])
            || (adapter.createdStatesDetails[objName]
                && ( common.name !== adapter.createdStatesDetails[objName].name
                    || common.type !== adapter.createdStatesDetails[objName].type
                    || common.role !== adapter.createdStatesDetails[objName].role
                    || common.read !== adapter.createdStatesDetails[objName].read
                    || common.unit !== adapter.createdStatesDetails[objName].unit
                    || common.write !== adapter.createdStatesDetails[objName].write
                    || common.states !== adapter.createdStatesDetails[objName].states
                    || common.modify !== adapter.createdStatesDetails[objName].modify
                )
            )) {
			adapter.log.debug(`Attribute definition changed for '${objName}' with '${JSON.stringify(common)}'`);
			await adapter.extendObjectAsync(objName, {
				type: "state",
				common
			});

		} else {
			// console.log(`Nothing changed do not update object`);
		}

		// Store current object definition to memory
		adapter.createdStatesDetails[objName] = common;

		// Set value to state
		if (value !== undefined) {
			//adapter.log.info('Common.mofiy: ' + JSON.stringify(common.modify));
			if (common.modify != "" && typeof common.modify == "string") {
				adapter.log.debug(`Value "${value}" for name "${objName}" before function modify with method "${common.modify}"`);
				value = modify(common.modify, value);
				adapter.log.debug(`Value "${value}" for name "${objName}" after function modify with method "${common.modify}"`);
			} else if (typeof common.modify == "object") {
				for (const i of common.modify) {
					adapter.log.debug(`Value "${value}" for name "${objName}" before function modify with method "${i}"`);
					value = modify(i, value);
					adapter.log.debug(`Value "${value}" for name "${objName}" after function modify with method "${i}"`);
				}
			}
			adapter.log.debug(`State "${objName}" set with value "${value}" and expire time "${expire}"`);
			await adapter.setStateAsync(objName, {
				val: value,
				ack: true,
				expire: expire
			});
		}

		// Subscribe on state changes if writable
		common.write && adapter.subscribeStates(objName);

	} catch (error) {
		const eMsg = `Error in function stateSetCreate(): ${error}`;
		adapter.log.error(eMsg);
		console.error(eMsg);
	}
}

/**
 * Deletes device + channels + states
 * @param {string} devicename devicename (not the whole path) to be deleted
 */
async function deleteEverything(devicename) {
	await adapter.deleteDeviceAsync(devicename);
	const states = await adapter.getStatesAsync(`${devicename}.*`);
	for (const idS in states) {
		await adapter.delObjectAsync(idS);
	}
}

module.exports = {
	TraverseJson: TraverseJson,
	stateSetCreate: stateSetCreate,
	init: init,
	deleteEverything: deleteEverything,
	getStateAttrKeys: getStateAttrKeys
};
