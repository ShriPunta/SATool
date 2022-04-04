import { LightningElement, wire } from 'lwc';

import getSobjList from '@salesforce/apex/SATController.getSobjList';

export default class SobjectFilter extends LightningElement {
    allSobjs = [];
    defaultObjSelect = {};
    selectedObj = {};
    @wire(getSobjList, {})
    wiredGetSobjList(value) {
        if (value.error) {
            console.log('--->',JSON.parse(JSON.stringify(value)));
            this.error = value.error;
        } else if (value.data) {
            this.allSobjs = value.data;
            console.log('--->',JSON.parse(JSON.stringify(this.allSobjs)));
            this.defaultObjSelect.label = this.allSobjs[0].label;
            this.defaultObjSelect.value = this.allSobjs[0].value;
        }
    }

    handlePicklistSelect(event){
        if(event.detail.picklist == 'Sobject'){
            console.log('--->',JSON.parse(JSON.stringify(event.detail)));
            this.selectedObj = {
                label: event.detail.label,
                value: event.detail.value,
            }
            this.dispatchEvent(new CustomEvent('filterupdate', { detail: { filters: { sobjectname : event.detail.value } } } ));
        }
    }
}