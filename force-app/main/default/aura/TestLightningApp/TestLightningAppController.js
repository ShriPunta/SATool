({
	navigate : function(component, event, helper) {
        var urlString = window.location.origin;
 		console.log('==>',urlString);
		window.open(urlString,'_top');
	}
})