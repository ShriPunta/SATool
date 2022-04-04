import { LightningElement,track,wire } from 'lwc';
import { subscribe, MessageContext } from 'lightning/messageService';
import POPULATE_SA_TABLE_MSG from '@salesforce/messageChannel/PopulateSATable__c';
import getObjectPermissions from '@salesforce/apex/SATController.getObjectPermissions';
import {ShowToastEvent} from 'lightning/platformShowToastEvent'

export default class SaTable extends LightningElement {
    
    /** JSON.stringified version of filters to pass to apex */
    filters = {};
    @track perms;
    columns = [
        { label: 'Field name', fieldName: 'fieldName', type: 'text' },
        {
            label: 'Read Permission',
            fieldName: 'readPerm',
            type: 'boolean',
            // cellAttributes: {
            //     iconName: { fieldName: 'readPermIcon' },
            //     iconPosition: 'right',
            // }
        },
        {
            label: 'Edit Permission',
            fieldName: 'editPerm',
            type: 'boolean',
            // cellAttributes: {
            //     iconName: { fieldName: 'editPermIcon' },
            //     iconPosition: 'right',
            // }
        },
        { 
            label: 'Access By',
            fieldName: 'accessByName',
            type: 'string',
            cellAttributes: {
                iconName: { fieldName: 'accessByIcon' },
                iconPosition: 'right',
            }
        }
    ];
//"trendIcon": "action:close"
//"trendIcon": "action:approval"
    // @track isTableLoading;

    /** Load context for Lightning Messaging Service */
    @wire(MessageContext) messageContext;

    /**
     * Load the permissions.
     */
    //  @wire(getObjectPermissions, { filter: '$filters' })
    //  perms;

    /** Subscription for SA Table Population Lightning message */
    populateTableSubscription;

    connectedCallback() {
        
        // Subscribe to populate table message
        this.populateTableSubscription = subscribe(
            this.messageContext,
            POPULATE_SA_TABLE_MSG,
            (message) => this.handleFilterChange(message)
        );
    }

    handleFilterChange(message) {
        console.log('message recevied!');
        this.filters = { ...message.filters };
        getObjectPermissions({
            filter: this.filters
        })
        .then(result => {
            // set @track contacts variable with return contact list from server  
            this.perms = result;
        })
        .catch(error => {
            const event = new ShowToastEvent({
                title: 'Error',
                variant: 'error',
                message: error.body.message,
            });
            this.dispatchEvent(event);
            // reset contacts var with null   
            this.contactsRecord = null;
        })
        .finally(() => this.dispatchEvent(new CustomEvent('spinnerupdate', { detail: { spinner: false } })));;
        
    }
    
    getSelectedRows(event) {
        const selectedRows = event.detail.selectedRows;
        // Display that fieldName of the selected rows
        console.log('--1->',JSON.parse(JSON.stringify(selectedRows.length)));
        // for (let i = 0; i < selectedRows.length; i++) {
        //     alert('You selected: ' + selectedRows[i].opportunityName);
        // }
    }

}