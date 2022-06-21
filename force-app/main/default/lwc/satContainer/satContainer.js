import { LightningElement, track } from 'lwc';

export default class SatContainer extends LightningElement {
	@track showSpinner=false;

	toggleSpinner(event){
		this.showSpinner=event.detail.spinner;
	}
}