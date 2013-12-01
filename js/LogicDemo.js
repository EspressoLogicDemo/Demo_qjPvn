//////////////////////////////////////////////////////////////
// Presentation logic for Espresso Logic demo
//
// Please note that this is *not* intended as a model of how to write
// a JavaScript app. A lot of things could be done more elegantly with
// a framework like AngularJS, but the purpose of this app is to 
// show what can be done with Espresso Logic.

// The URL to the demo project
var baseUrl="https://livedemo.espressologic.com/rest/demo/Demo_qjPvn/v1/";

// The API key use to access the demo project
var currentApiKey = "KSqTYuRAP0UCd1x";

function checkCorsSupport() {
	var xhr = new XMLHttpRequest();
	if ("withCredentials" in xhr)
		return true;
	else if (typeof XDomainRequest != "undefined")
		return true;
	else
		return false;
}

$(function () {
	
	if ( ! checkCorsSupport()) {
		alert("This browser does not support Cross-Origin Resource Sharing (CORS) and therefore " +
				"cannot run this application. We suggest using a modern browser such as Firefox or Chrome.");
		return;
	}
	
	// Load the Mustache templates, which are stored in the page as scripts
	var scripts = document.getElementsByTagName('script');
	var trash = [];
	$.each(scripts, function(index, script) {
		if (script && script.innerHTML && script.id && script.type === "text/html") {
			templates[script.id] = Handlebars.compile(script.innerHTML);
			trash.unshift(script);
		}
	});
	// And remove the templates from the document
    for (i = 0, l = trash.length; i < l; i++) {
        trash[i].parentNode.removeChild(trash[i]);
    }
    
//    $('#eventsTreeContainer').resizable({ handles: 's, se, e' });
    
    // Set the default for all Ajax calls
    $.ajaxSetup({
    	contentType: "application/json"
    });

	loadCustomerList();
});

var templates = {};

// All calls to the logic server go through this
/**
 * type: get, post, put or delete
 * url: ...
 * aync: boolean
 * doneFunction: call when data is back
 */
function makeCall(type, url, data, params, async, doneFunction) {
	if (url.substring(0, 4) != "http")
		url = baseUrl + url;
	var args = "";
	if (params) {
		for (var name in params) {
			if ( ! params.hasOwnProperty(name))
				continue;
			args += args.length == 0 ? "?" : "&";
			args += name + "=" + escape(params[name]);
		}
	}
	if ($("#showTxSummary").attr("checked")) {
		args += args.length == 0 ? "?" : "&";
		args += "ruleSummary=true";
	}
	if (type != "GET") {
		args += args.length == 0 ? "?" : "&";
		args += "changeSummary=true";
	}
	var hdrs = {"Authorization": "Espresso " + currentApiKey + ":1"};
	
	// For GET, we put the authentication on the URI, that saves an OPTIONS request
	if (type == "GET") {
		args += args.length == 0 ? "?" : "&";
		args += "auth=" + currentApiKey + ":1";
		hdrs = {};
	}
	url += args;

	jQuery.support.cors = true;
	$.ajax({		// $ ==> jQuery
		type: type,
		url: url,
		headers: hdrs,
		dataType: "json",
		data: data,
		async: async,
		error: function(jqXHR, textStatus, errorThrown) {
			if (jqXHR.responseText && jqXHR.responseText[0] == '{') {
				var errorObj = eval('(' + jqXHR.responseText + ')');
				if (errorObj.errorMessage)
					alert(errorObj.errorMessage);
				else
					alert("Ajax failed : " + errorThrown);
			}
			else
				alert("Ajax failed : " + errorThrown);
		}
	}).done(doneFunction);
}

function loadCustomerList() {
	$('#custNameControl').children().remove();
	makeCall("GET", "AllCustomers", null, null, true, function(data){
		for (var i = 0; i < data.length; i++) {
			var cust = data[i];
			$('#custNameControl').append("<option value='" + cust.customer_ident + "'>" + cust.name + "</option>");
		}
		refreshCustomer();
	});
}

var currentCustomer;
function refreshCustomer() {
	var custIdent = $('#custNameControl').val();
	makeCall("GET", "OneCustomer/" + custIdent,
			null, null, true, function(data) {
				currentCustomer = data[0];
				refreshCustomerWithData();
				$('#ordersTable').html("");
				refreshOrders();
			});
}

function refreshCustomerWithData() {
	$('#customerName').html(currentCustomer.name);
	$('#custBalanceTd').html(currentCustomer.balance.toFixed(2));
	$('#creditLimit').val(currentCustomer.credit_limit.toFixed(2));
}

function switchApiKey() {
	currentApiKey = $('#apiKeySelect').val();
	loadCustomerList();
}

function refreshOrders() {
	var orders = currentCustomer.Orders;
	for (var i = 0; i < orders.length; i++) {
		var order = orders[i];
		order.getReassignCustomerSelect = (function() {
			var orderNum = order.order_number;
			return function() { return getReassignCustomerSelect(orderNum); };
		})();
		$('#orderRow' + order.order_number).remove();
		var html = templates.orderTemplate(order);
		$('#ordersTable').prepend(html);
		getLineitems(order);
	}
}

function refreshOrderWithData(order) {
	$('#amountTotal' + order.order_number).html('$' + order.amount_total.toFixed(2));
}

var currentLineitems = {};
function getLineitems(order) {
	var items = order.Lineitems;
	for (var i = 0; i < items.length; i++) {
		var lineitemId = items[i].lineitem_id;
		currentLineitems[lineitemId] = items[i];
		var theItem = items[i];
		items[i].getProductSelect = (function() { // Note the closure, since we're in a loop, and variables are shared
			var prodNum = theItem.product_number;
			var itemId = theItem.lineitem_id;
			return function(){return getProductSelect(itemId, prodNum);};
		})();
		var html = templates.lineitemTemplate(items[i]);
		$('#itemsForOrder' + order.order_number).prepend(html);
	}
}

function refreshLineitemWithData(lineitem) {
	if (lineitem.product_price)
		$('#productPrice' + lineitem.lineitem_id).val('$' + lineitem.product_price.toFixed(2));
	if (lineitem.amount)
		$('#amount' + lineitem.lineitem_id).html('$' + lineitem.amount.toFixed(2));
}

var products;
function getProductSelect(ItemNum, ProductNumber) {
	if (products == null) {
		makeCall("GET", "Products", null, null, false, function(data) {
			products = data;
		});
	}
	var html = templates.productSelectTemplate({ItemNum: ItemNum, ProductNumber: ProductNumber, products: products});
	return html;
}

Handlebars.registerHelper('prodSelect', function(items, options) {
	var html = "";
	var prodNum = options.fn({});
	for (var i = 0, l = items.length; i < l; i++) {
		var item = items[i];
		html = html + "<option value='" + item.product_number + "'";
		if (item.product_number == prodNum)
			html = html + " selected";
		html = html + ">" + item.name + "\n";  // FIXME what's this?
	  }
	return html;
});

var customers;
function getReassignCustomerSelect(orderId) {
	if (customers == null) {
		makeCall("GET", "AllCustomers", null, null, false, function(data) {
			customers = data;
		});
	}
	var optionsHtml = "";
	for (var i = 0; i < customers.length; i++) {
		var cust = customers[i];
		if (escape(cust.customer_ident) == $('#custNameControl').val())
			continue;
		optionsHtml += "<option value='" + cust.customer_ident + "'>" + cust.name + "\n";
	}
	var obj = {orderId: orderId, options: optionsHtml};
	var html = templates.reassignCustomerSelectTemplate(obj);
	return html;
}

function reassignOrder(orderId, custName, custIdent) {
	var order = getOrder(orderId);
	var data = JSON.stringify({order_number: orderId, customer_ident: custIdent, '@metadata': {checksum: order['@metadata'].checksum}});
//	var order = currentOrders[orderId];
	makeCall("PUT", order['@metadata'].href, data, {}, true, function(response) {
		refreshAfterUpdate(response);
		$('#messageDiv').html("Order " + orderId + " has been reassigned to customer " + custName);
		$('#messageDiv').slideDown(500).delay(3000).slideUp(500);
	});
}

function createOrder() {
	var data = JSON.stringify({customer_ident: currentCustomer.customer_ident, paid: false});
	makeCall("POST", "OneCustomer.Orders", data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

function flipOrderPaid(orderId, checked) {
	var order = getOrder(orderId);
	var data = JSON.stringify({order_number: orderId, '@metadata': {checksum: order['@metadata'].checksum}, paid: checked});
	makeCall("PUT", order['@metadata'].href, data, {}, true, function(response) {
		refreshAfterUpdate(response);
	});
}

function deleteOrder(orderId) {
	if ( ! confirm('Delete this order?'))
		return;
	var order = getOrder(orderId);
	makeCall("DELETE", order['@metadata'].href, null, {checksum: order['@metadata'].checksum}, true, function(response) {
		refreshAfterUpdate(response);
	});
}

function getOrderIndex(order) {
	for (var i = 0; i < currentCustomer.Orders.length; i++) {
		var ord = currentCustomer.Orders[i];
		if (ord.order_number == order.order_number) {
			return i;
		}
	}
	return -1;
}

// Find an order based on its order_number
function getOrder(orderId) {
	for (var i = 0; i < currentCustomer.Orders.length; i++) {
		var ord = currentCustomer.Orders[i];
		if (ord.order_number == orderId) {
			return ord;
		}
	}
}

function updateNotes(orderId, notes) {
	var order = getOrder(orderId);
	var data = JSON.stringify({order_number: orderId, '@metadata':{checksum: order['@metadata'].checksum}, notes: notes});
	makeCall("PUT", order['@metadata'].href, data, null, true, null);
}

function updateCreditLimit(newValue) {
	var data = JSON.stringify({customer_ident: currentCustomer.customer_ident, '@metadata': {checksum: currentCustomer['@metadata'].checksum}, credit_limit: newValue});
	makeCall("PUT", currentCustomer['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

function updateQuantity(lineitemId, newValue) {
	var lineitem = currentLineitems[lineitemId];
	var data = JSON.stringify({lineitem_id: lineitemId, '@metadata':{checksum: lineitem['@metadata'].checksum}, qty_ordered: newValue});
	makeCall("PUT", lineitem['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

function updatePrice(lineitemId, newPrice) {
	newPrice = newPrice.replace(/\$|,/g, '');
	newPrice = parseFloat(newPrice);
	var lineitem = currentLineitems[lineitemId];
	var data = JSON.stringify({lineitem_id: lineitemId, '@metadata': {checksum: lineitem['@metadata'].checksum}, product_price: newPrice});
	makeCall("PUT", lineitem['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

function updateProduct(lineitemId, newProductNum) {
	var lineitem = currentLineitems[lineitemId];
	var data = JSON.stringify({lineitem_id: lineitemId, '@metadata': {checksum: lineitem['@metadata'].checksum}, product_number: newProductNum});
	makeCall("PUT", lineitem['@metadata'].href, data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

function createLineitem(orderId) {
	var data = JSON.stringify({product_number:1, order_number: orderId, qty_ordered: 1});
	makeCall("POST", "OneCustomer.Orders.Lineitems/", data, null, true, function(response) {
		refreshAfterUpdate(response);
	});
}

function deleteLineitem(lineitemId) {
	if ( ! confirm('Delete this line item?'))
		return;
	var lineitem = currentLineitems[lineitemId];
	var data = JSON.stringify({lineitem_id: lineitemId});
	makeCall("DELETE", lineitem['@metadata'].href, data, {checksum: lineitem['@metadata'].checksum}, true, function(response) {
		refreshAfterUpdate(response);
	});
}

// Based on the transaction summary received after any insert/update/delete, refresh
// whatever needs refreshing on the page.
function refreshAfterUpdate(response) {
	var data = response.txsummary;
	if ( ! data)
		return;
	for (var i = 0; i < data.length; i++) {
		var obj = data[i];
		var objType = obj['@metadata'].resource;
		if (objType == "OneCustomer" && obj.customer_ident == currentCustomer.customer_ident) {
			currentCustomer.balance = obj.balance;
			currentCustomer.credit_limit = obj.credit_limit;
			currentCustomer['@metadata'].checksum = obj['@metadata'].checksum;
			refreshCustomerWithData();
		}
		else if (objType == "OneCustomer.Orders") {
			if (obj['@metadata'].verb == "DELETE") {
				currentCustomer.Orders.splice(getOrderIndex(obj), 1);
				$('#orderRow' + obj.order_number).remove();
			}
			else if (obj['@metadata'].verb == "UPDATE") {
				if (obj.customer_ident != currentCustomer.customer_ident) { // Reassigned order
					var orderIdx = getOrderIndex(obj);
					if (orderIdx != -1)
						currentCustomer.Orders.splice(orderIdx, 1);
					$('#orderRow' + obj.order_number).remove();
				}
				else {
					// Swap in the new values for the updated order and refresh
					for (var j = 0; j < currentCustomer.Orders.length; j++) {
						if (currentCustomer.Orders[j].order_number == obj.order_number) {
							currentCustomer.Orders[j].amount_total = obj.amount_total;
							currentCustomer.Orders[j].paid = obj.paid;
							currentCustomer.Orders[j].notes = obj.notes;
							currentCustomer.Orders[j].customer_ident = obj.customer_ident;
							currentCustomer.Orders[j]['@metadata'].checksum = obj['@metadata'].checksum;
							break;
						}
					}
					refreshOrderWithData(obj);
				}
			}
			else if (obj['@metadata'].verb == "INSERT") {
				currentCustomer.Orders.push(obj);
				obj.getReassignCustomerSelect = (function() {
					var orderNum = obj.order_number;
					return function() { return getReassignCustomerSelect(orderNum); };
				})();
				var html = templates.orderTemplate(obj);
				$('#ordersTable').prepend(html);
			}
		}
		else if (objType == "OneCustomer.Orders.Lineitems") {
			if (obj['@metadata'].verb == "DELETE") {
				delete currentLineitems[obj.lineitem_id];
				$('#lineitemRow' + obj.lineitem_id).remove();
			}
			else if (obj['@metadata'].verb == "UPDATE") {
				currentLineitems[obj.lineitem_id] = obj;
				refreshLineitemWithData(obj);
			}
			else if (obj['@metadata'].verb == "INSERT") {
				currentLineitems[obj.lineitem_id] = obj;
				obj.getProductSelect = function(){return getProductSelect(obj.lineitem_id, obj.product_number);};
				var html = templates.lineitemTemplate(obj);
				$('#itemsForOrder' + obj.order_number).prepend(html);
			}
		}
	}
	
	
	/// Show the logic summary if it was in the response
	var logic = response.rulesummary;
	if (logic) {		
		Kahuna.LogicPlan.displayLogic('#eventsTree', logic, function(evt){
			if (evt)
				$('#eventDetails').html("<b>Details</b>: " + Kahuna.LogicPlan.formatEvent(evt));
			else
				$('#eventDetails').html("Select a node in the tree");
		});
		$('#eventDetails').html("Select a node in the tree");
		$('#txSummary').show();
	}
	else {
		$('#txSummary').hide();
	}
}

// A simple function to check whether an input is a valid number.
function isNumber(str) {
	if (str.length == 0)
		return false;

	numdecs = 0; // Number of decimal points -- should be max 1, obviously
	for (var i = 0; i < str.length; i++) {
		mychar = str.charAt(i);
		if ((mychar >= "0" && mychar <= "9") || mychar == "." || mychar == "$" || mychar == ",") {
			if (mychar == ".")
				numdecs++;
		}
		else 
			return false;
	}
	if (numdecs > 1) {
		return false;
	}
	return true;
}
