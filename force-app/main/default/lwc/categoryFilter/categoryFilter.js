/*
* 
*/
import { LightningElement, track, wire } from 'lwc';
import getProfiles from '@salesforce/apex/SATController.getProfiles';
import getUserList from '@salesforce/apex/SATController.getUserList';
import { NavigationMixin } from 'lightning/navigation';
import USER_OBJECT from '@salesforce/schema/User';
// import standard toast event 
import {ShowToastEvent} from 'lightning/platformShowToastEvent'

// The delay used when debouncing event handlers before firing the event
const SEARCH_DEBOUNCE_DELAY = 350;
export default class QueryBox extends NavigationMixin(LightningElement) {
	allProfiles = [];
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
					// reset userRecs var with null   
					this.userRecs = null;
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
		console.log('recs-1->',this.userRecs);
		let userRecId = event.currentTarget.dataset.id;
		console.log('userId-2->',userRecId);
		let userObj = this.userRecs.filter(({Id}) => Id==userRecId)[0];
		console.log('-3->',JSON.parse(JSON.stringify(userObj)));
		this.selectedUser = userObj;
		this.userSearchValue = userObj.Username;
		this.filters.user = userRecId;
		this.filters.profile = '';
		this.userRecs = null;
		console.log('-4-->',JSON.parse(JSON.stringify(this.filters)));
		this.conveyFiltersToParent();
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

	get catOptions() {
		return [
			{ label: 'Profile', value: 'Profile' },
			{ label: 'User', value: 'User' },
		];
	}

	handleProfileSelect(event){
		if(event.detail.picklist == 'Profile'){
			console.log('--5->',JSON.parse(JSON.stringify(event.detail)));
			this.selectedProfile = {
				label: event.detail.label,
				value: event.detail.value,
			}
			this.filters.profile = event.detail.value;
			this.filters.user = '';
			console.log('--6->',JSON.parse(JSON.stringify(this.filters)));
			this.conveyFiltersToParent();
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

	conveyFiltersToParent(){
		// const detail = {};
		// detail["filters"] = this.filters;
		this.dispatchEvent(new CustomEvent('filterupdate', { detail: { filters: this.filters } }));
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