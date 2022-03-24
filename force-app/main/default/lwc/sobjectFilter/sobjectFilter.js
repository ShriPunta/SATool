import { LightningElement, wire } from 'lwc';

import getSobjList from '@salesforce/apex/SATController.getSobjList';

export default class SobjectFilter extends LightningElement {
    allSobjs = [];
    defaultObjSelect = {};

    @wire(getSobjList, {})
    wiredGetSobjList(value) {
        if (value.error) {
            this.error = value.error;
        } else if (value.data) {
            this.allSobjs = value.data;
            this.defaultObjSelect.label = this.allSobjs[0].label;
            this.defaultObjSelect.value = this.allSobjs[0].value;
        }
    }
}