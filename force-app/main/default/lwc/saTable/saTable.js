import { LightningElement,track,wire } from 'lwc';
import { subscribe, MessageContext } from 'lightning/messageService';
import POPULATE_SA_TABLE_MSG from '@salesforce/messageChannel/PopulateSATable__c';
import getObjectPermissions from '@salesforce/apex/SATController.getObjectPermissions';
import getSystemVars from '@salesforce/apex/SATController.getSystemVars';
import {ShowToastEvent} from 'lightning/platformShowToastEvent'

const SEARCH_DEBOUNCE_DELAY = 350;
//https://webcomponents.dev/edit/sxflCpdhbEAL3XGmX0J5/src/app.js?p=stories
export default class SaTable extends LightningElement {
    
    /** JSON.stringified version of filters to pass to apex */
    filters = {};
    @track filteredperms;
    permsMap= new Map();
    searchKey='';
    searchBarPlaceholder;
    systemvars = {}
    @wire(getSystemVars, {})
    wiredGetSobjList(value) {
        if (value.error) {
            console.error('-systemvarserror-->',JSON.parse(JSON.stringify(value)));
            const event = new ShowToastEvent({
                title: 'System Var retrieval error',
                variant: 'error',
                message: error.body.message,
            });
            this.dispatchEvent(event);
        } else if (value.data) {
            this.systemvars = value.data;
            console.log('--systemvars->',JSON.parse(JSON.stringify(this.systemvars)));
        }
    }
    
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
            fieldName: 'accessByUrl',
            type: 'url',
            wrapText: true,
            typeAttributes: {
                label: { 
                    fieldName: 'accessByName' 
                },
                target : '_blank'
            },
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

    async handleFilterChange(message) {
        this.filters = { ...message.filters };
        this.searchKey='';
        try{
            let res = await getObjectPermissions({filter: this.filters});
            this.searchBarPlaceholder = `Search ${this.filters.sobjectname} fields`;
            this.permsMap = this.massageJSONToMap(res);//new Map(res.map(i => [i.Id, i]));
            this.filteredperms = [...this.permsMap.values()];
        }catch(error){
            const event = new ShowToastEvent({
                title: 'Permission table population error',
                variant: 'error',
                message: error.body.message,
            });
            this.dispatchEvent(event);
            // reset contacts var with null   
            this.permsMap = null;
        }
        this.dispatchEvent(new CustomEvent('spinnerupdate', { detail: { spinner: false } }));
    }

    massageJSONToMap(apexArr){
        let permMap = new Map();
        // let baseHref = `https://${window.location.origin}/`;
        let baseHref = `${this.systemvars.baseURL}/`;
        console.log('--->',JSON.parse(JSON.stringify(this.systemvars)));
        apexArr.forEach((fp) => {
            let row = {};
            row.id=fp.Id;
            row.editPerm=fp.PermissionsEdit;
            row.editPermIcon=fp.PermissionsEdit?'utility:check':'utility:close';
            row.readPerm=fp.PermissionsRead;
            row.readPermIcon=fp.PermissionsRead?'utility:check':'utility:close';
            if(fp.Parent.IsOwnedByProfile){
                row.accessByName=fp.Parent.Profile.Name;
                row.accessByIcon='utility:profile';
                row.accessByUrl = baseHref+fp.Parent.ProfileId;
            }else{
                row.accessByName=fp.Parent.Name;
                row.accessByIcon='utility:attach';
                row.accessByUrl = baseHref+fp.ParentId;
            }
            row.fieldName=fp.Field;
            permMap.set(fp.Field, row)
        });
        return permMap;
    }

    handleSearchKeyChange(event){
        this.searchKey = event.target.value;
        this.delayedFireTableFilterEvent();
    }

    filterPermsTable(){
        const regM = new RegExp(`${this.searchKey}`, 'gi');
        this.filteredperms=[...this.permsMap.values()].filter(({fieldName}) => fieldName.match(regM));
    }

    delayedFireTableFilterEvent() {
        // Debouncing this method: Do not actually fire the event as long as this function is
        // being called within a delay of DELAY.
        window.clearTimeout(this.delayTimeout);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.delayTimeout = setTimeout(() => {
            this.filterPermsTable();
        }, SEARCH_DEBOUNCE_DELAY);
    }

    getSelectedRows(event) {
        const selectedRows = event.detail.selectedRows;
        // Display that fieldName of the selected rows
        // for (let i = 0; i < selectedRows.length; i++) {
        //     alert('You selected: ' + selectedRows[i].opportunityName);
        // }
    }

}