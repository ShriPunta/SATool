import { LightningElement, track, wire } from 'lwc';
import getProfiles from '@salesforce/apex/SATController.getProfiles';
import getUserList from '@salesforce/apex/SATController.getUserList';
import { publish, MessageContext } from 'lightning/messageService';
import PROFILES_FILTERED_MESSAGE from '@salesforce/messageChannel/ProfilesFiltered__c';
import { NavigationMixin } from 'lightning/navigation';
import USER_OBJECT from '@salesforce/schema/User';
// import standard toast event 
import {ShowToastEvent} from 'lightning/platformShowToastEvent'

// The delay used when debouncing event handlers before firing the event
const SEARCH_DEBOUNCE_DELAY = 350;
export default class QueryBox extends NavigationMixin(LightningElement) {
    // TODO: Use the custom picklist solution online and show Sobject and their fields
    // Use Cache.Org Partition to store Schema.getDescribe
    allProfiles = [];
    filteredUsers = [];
    filteredUsersOptions=[];
    selectedCat = 'Profile';
    isProfileSelected = true;
    isUserSelected = false;
    userSearchValue = '';
    defaultProfSelect = {}
    selectedUser;
    filters={
        profile : '',
        user : ''
    }
    @track userRecs;
    @track selectedProfile;
    @track isUserSearchLoading;
    
    
    // userSearchKeyword(event) {
    //     this.userSearchValue = event.target.value;
    // }
    
     // call apex method on button click 
     handleUserSearch() {
        if (this.userSearchValue !== '') {
            this.isUserSearchLoading = true;
            getUserList({
                    searchKey: this.userSearchValue
                })
                .then(result => {
                    // set @track contacts variable with return contact list from server  
                    this.userRecs = result;
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
                .finally(() => this.isUserSearchLoading = false);;
        } else {
            // fire toast event if input field is blank
            const event = new ShowToastEvent({
                variant: 'error',
                message: 'Search text missing..',
            });
            this.dispatchEvent(event);
        }
    }

    handleQueriedUserSelect(event){
        console.log('recs-->',this.userRecs);
        let userRecId = event.currentTarget.dataset.id;
        console.log('userId-->',userRecId);
        let userObj = this.userRecs.filter(({Id}) => Id==userRecId)[0];
        console.log('-->',JSON.parse(JSON.stringify(userObj)));
        this.selectedUser = userObj;
        this.userSearchValue = userObj.Username;

    }

    handleRadChange(event){
        if(event.detail.value=='Profile'){
            this.isProfileSelected=true;
            this.isUserSelected=false;
        }else if(event.detail.value=='User'){
            this.isProfileSelected=false;
            this.isUserSelected=true;
        }
    }

    @wire(getProfiles, {})
    wiredGetProfiles(value) {
        if (value.error) {
            this.error = value.error;
        } else if (value.data) {
            this.allProfiles = value.data;
            this.defaultProfSelect.label = this.allProfiles[0].label;
            this.defaultProfSelect.value = this.allProfiles[0].value;
        }
    }

    @wire(MessageContext)
    messageContext;

	get catOptions() {
        return [
            { label: 'Profile', value: 'Profile' },
            { label: 'User', value: 'User' },
        ];
    }

    handleProfileSelect(event){
        if(event.detail.picklist == 'Profile'){
            this.selectedProfile = {
                label: event.detail.label,
                value: event.detail.value,
            }
            console.log('--->',JSON.parse(JSON.stringify(this.selectedProfile)));
        }
    }

    handleSearchKeyChange(event) {
        this.userSearchValue = event.target.value;
        if(!this.userSearchValue || this.userSearchValue.length < 4){
            this.userRecs = [];
        }else{
            this.delayedFireFilterChangeEvent();
        }
    }

    delayedFireFilterChangeEvent() {
        // Debouncing this method: Do not actually fire the event as long as this function is
        // being called within a delay of DELAY. This is to avoid a very large number of Apex
        // method calls in components listening to this event.
        window.clearTimeout(this.delayTimeout);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.delayTimeout = setTimeout(() => {
            this.handleUserSearch();
            // if(this.allProfiles){
            //     const regM = new RegExp(`${this.filters.searchKey}`, 'gi');
            //     this.filteredProfiles=this.allProfiles.filter(({Name}) => Name.match(regM));

            // }
            // Published ProfilesFiltered message
            // publish(this.messageContext, PROFILES_FILTERED_MESSAGE, {
            //     filters: this.filters
            // });
        }, SEARCH_DEBOUNCE_DELAY);
    }

    handleNavigateToRecord(event) {
        let recordId = event.currentTarget.dataset.id;
        this[NavigationMixin.GenerateUrl]({
            type: "standard__recordPage",
            attributes: {
                recordId: recordId,
                objectApiName: USER_OBJECT.objectApiName,
                actionName: 'view'
            }
        }).then(url => {
            window.open(url, "_blank");
        });
    }
}