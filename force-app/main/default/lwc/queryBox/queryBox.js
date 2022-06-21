import { LightningElement, wire } from 'lwc';
import { publish, MessageContext } from 'lightning/messageService';
import POPULATE_SA_TABLE_MSG from '@salesforce/messageChannel/PopulateSATable__c';

export default class QueryBox extends LightningElement {
	filters={
		user : "",
		profile : "",
		sobjectname : ""
	}
	@wire(MessageContext)
	messageContext;

	handlefilterupdate(event){
		console.log('--1->',JSON.parse(JSON.stringify(this.filters)));
		if(event.detail.filters.user){
			this.filters.user = event.detail.filters.user;
			this.filters.profile = '';
		} else if(event.detail.filters.profile){
			this.filters.profile = event.detail.filters.profile;
			this.filters.user = '';
		}
		console.log('--2->',JSON.parse(JSON.stringify(this.filters)));
		if(event.detail.filters.sobjectname){
			this.filters.sobjectname = event.detail.filters.sobjectname;
		}
		console.log('--4->',JSON.parse(JSON.stringify(this.filters)));
		if(this.filters && (this.filters.profile || this.filters.user) && this.filters.sobjectname){
			this.dispatchEvent(new CustomEvent('spinnerupdate', { detail: { spinner: true } }));
			publish(this.messageContext, POPULATE_SA_TABLE_MSG, {
				filters: this.filters
			});
		}
	}
}