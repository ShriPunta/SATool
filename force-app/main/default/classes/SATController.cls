/**********************************************************************************************
 * @name			SATController
 * @author			Shridhar Puntambekar [https://github.com/ShriPunta]
 * @created			2022-03-24
 * @description		Controller for the Salesforce Access Tool.
**********************************************************************************************/
public with sharing class SATController {
	/**-----------------------------------------------------------------------------------
	- This static variable will holds partition reference.
	=======================================================================================
	- Platform cache makes the page load faster by caching the sobject name list. (getSobjList)
	- This cache is optional and if the feature is not available in the target org,
	the cache will always miss and work normally.
	-----------------------------------------------------------------------------------**/
	private static Cache.OrgPartition satPart = Cache.Org.getPartition('local.SATool');

	/**-----------------------------------------------------------------------------------
	- Provides the system variables required for the LWC.
	=======================================================================================
	- baseURL : This is used to build the hyperlinks in the components.
	-----------------------------------------------------------------------------------**/
	@AuraEnabled(Cacheable=true)
	public static SystemVars getSystemVars() {
		SystemVars s = new SystemVars();
		s.baseURL = Url.getOrgDomainUrl().toExternalForm();
		return s;
	}
	
	/**-----------------------------------------------------------------------------------
	- This method provides a list of all sobjects in the org with their label+apinames in a 
	map format. It is called on every page load.
	=======================================================================================
	To improve page efficiency, Platform Cache is used so that each page load does not 
	cost multiple queries. As it is org cache, it applies to all users who open the page.
	=======================================================================================
	The method queries in a loop to get the list of all sobjects in the org.
	As the method queries the tooling metadata, each query is limited to a size of 2000.
	The method simulates paging:
		- by ORDERING by Developername
		- using the QualifiedApiName as a marker for the last record queried.
	-----------------------------------------------------------------------------------**/
	@AuraEnabled(Cacheable=true)
	public static List<Map<String, String>> getSobjList() {
		List<Map<String, String>> retList = new List<Map<String, String>>();
		Map<String,String> qAPINameAndLabelMap = (Map<String,String>)satPart.get('sobjs');
		// Check the cache value that the get() call returned.
		if (qAPINameAndLabelMap==null||qAPINameAndLabelMap.isEmpty()) {
			String lastQueriedItem;
			String qFields = 'QualifiedApiName,Masterlabel';
			String qCount = 'count()';
			String q = 'SELECT {0} FROM EntityDefinition WHERE QualifiedApiName > :lastQueriedItem AND IsQueryable = true AND IsLayoutable = true AND IsIdEnabled=true AND IsCustomSetting=false AND IsApexTriggerable=true AND IsCustomizable=true {1} {2}';
			Integer objCount = Database.countQuery(String.format(q,new List<String>{ qCount,'','',''} ));
			qAPINameAndLabelMap = new Map<String,String>();
			while(objCount>0){
				for(EntityDefinition ed: (EntityDefinition[])Database.query(String.format(q,new List<String>{ qFields,'ORDER BY Developername','LIMIT 2000'}))){
					qAPINameAndLabelMap.put(ed.QualifiedApiName, ed.Masterlabel);
					lastQueriedItem=ed.QualifiedApiName;
				 }
				 objCount-=2000;
			}

			satPart.put('sobjs', qAPINameAndLabelMap);
		}
		for(String apiname : qAPINameAndLabelMap.keySet()){
			String s = qAPINameAndLabelMap.get(apiname) + '('+apiname+')';
			retList.add(new Map<String,String>{'value' => apiname, 'label' => s});
		}
		return retList;
	}

	/**-----------------------------------------------------------------------------------
	- Alternate/Backup method for getSobjList().
	=======================================================================================
	- This method uses Schema.getGlobalDescribe() instead of an SOQL to get the names of
	all object api names.
	-----------------------------------------------------------------------------------**/
	/*
	private static Set<String> generateListFromGlobalDesc(){
		Set<String> objNameSet = new Set<String>();
		Map<String , Schema.SObjectType > globaldesc = Schema.getGlobalDescribe();
		for(String sName: globaldesc.keySet()){
			Schema.SObjectType objType = globaldesc.get(sName);
			if(!objType.getDescribe().isCustomSetting() && sName.endsWithIgnoreCase('__c')){
				// Managed package
				if(sName.length() != (sName.indexOf('__') + 3) ){
					String pkg_ns = sName.substringBefore('__');
					if(SATConstants.pkgNameSpaces.contains(pkg_ns)){
						objNameSet.add(sName);
					}
				}
			}
		}
		return objNameSet;
	}
	*/

	/**----------------------------------------------------------------------------------
	- As the picklist component expects the data in a certain way to display as a picklist,
	 This utility method transforms a list of values into the desired List<Map<>> format.
	======================================================================================
	TODO: Server should only provide the list of api/label names. The client should do the
	 transformation. Move this method to LWC.
	-----------------------------------------------------------------------------------**/
	private static List<Map<String, String>> transformToListOfMap(Sobject[] sobjs, String valueAPIName, String labelAPIName){
		List<Map<String, String>> retList = new List<Map<String, String>>();
		for(Sobject sobj: sobjs){
			retList.add(new Map<String,String>{'value' => (String)sobj.get(valueAPIName), 'label' => (String)sobj.get(labelAPIName)});
		}
		return retList;
	}

	/**----------------------------------------------------------------------------------
	- Provides list of all profiles
	======================================================================================
	TODO: Server should only provide the list of api/label names. The client should do the
	 transformation. Move this method to LWC.
	-----------------------------------------------------------------------------------**/
	@AuraEnabled(Cacheable=true)
	public static List<Map<String, String>> getProfiles() {
		return transformToListOfMap(
			[SELECT Id,Name FROM Profile
			//WHERE UserLicense.Name = 'Salesforce'
			WITH SECURITY_ENFORCED],
			'Id','Name');
	}

	/**----------------------------------------------------------------------------------
	- This method is used to fuzzy search for users for a given searchkey.
	======================================================================================
	@Argument: searchKey - used to search usernames with the LIKE clause (%%).
	-----------------------------------------------------------------------------------**/
	@AuraEnabled(cacheable=true)
	public static list<User> getUserList(string searchKey) {
		string searchKeyword = '%' + searchKey + '%';
		User[] userList = new User[0];
	 
		for(User userObj : [Select Id,Name,Username,Email,SmallPhotoUrl
							From User
							WHERE username LIKE : searchKeyword
							AND IsActive=true AND Profile.UserLicense.Name = 'Salesforce' ORDER BY LastLoginDate DESC LIMIT 20]){
			userList.add(userObj);
		}
		
		 if(userList.size() == 0){
			throw new AuraHandledException('No Record Found..'); 
		 }
		 
		return userList;
	}

	/**----------------------------------------------------------------------------------
	- This method returns the actual backend permissions for the given filters.
	======================================================================================
	@Argument: Filter: A minimum combination of filters is expected to avoid queries that
	 return a massive number of records.
	-----------------------------------------------------------------------------------**/
	@AuraEnabled(Cacheable=true)
	public static FieldPermissions[] getObjectPermissions(Filters filter) {
		if((nbc(filter.profile)||nbc(filter.user)) && nbc(filter.sobjectname) /*&& nbc(filter.fieldName)*/){
			throw new AuraHandledException('Incomplete Filters.'); 
		}
		User u;
		String objName = filter.sobjectname;
		String profId = filter.profile;
		String userId = filter.user;
		
		String wClause = 'WHERE SobjectType=: objName ';
		if(!String.isBlank(userId)){
			u = [select Id,profileId from User where Id=:userId];
			if(u==null){
				throw new AuraHandledException('User not found.'); 
			}
			Id profileId = u.ProfileId;
			wClause+='AND (ParentId IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId =:userId))';
		}else if(!String.isBlank(profId)){
			wClause+='AND Parent.ProfileId =:profId AND Parent.IsOwnedByProfile = true';
		}
		
		//AND Parent.ProfileId =:profId AND Parent.IsOwnedByProfile = true';
		return (FieldPermissions[])Database.query('SELECT Id,Parent.IsOwnedByProfile,Field,ParentId,PermissionsEdit,PermissionsRead,Parent.Name,Parent.ProfileId,Parent.Profile.Name FROM FieldPermissions '+wClause);
	}
	
	@AuraEnabled(Cacheable=true)
	public static List<Map<String, String>> getSobjFieldList(String objName) {
		SObjectType r = ((SObject)Type.forName('Schema',objName).newInstance()).getSObjectType();
		List<Map<String, String>> customFields = new List<Map<String, String>>();

		Map<String,Schema.SObjectField> d = r.getDescribe().fields.getMap();
		for (SObjectField field : d.values()) {
			DescribeFieldResult dfr = field.getDescribe();
			if (dfr.isCustom()) {
				String apiName = dfr.getName();
				String label = dfr.getLabel() + '('+ apiName+')';
				customFields.add(new Map<String,String>{'value' => apiName, 'label' => label});
			}
		}
		return customFields;
	}

	private static Boolean nbc(String s){
		return s==null||String.isBlank(s);
	}

	public class Filters {
		@AuraEnabled
		public String user { get; set; }
		@AuraEnabled
		public String profile { get; set; }
		@AuraEnabled
		public String sobjectname { get; set; }
		// @AuraEnabled
		// public String fieldName { get; set; }
	}

	public class SystemVars {
		@AuraEnabled
		public String baseURL { get; set; }
	}

	/*
		System.debug('--miss-->'+Cache.Org.getPartition('local.SATool').getMissRate());
		System.debug('--avggsize-->'+Cache.Org.getPartition('local.SATool').getAvgGetSize());
		System.debug('--avggtime-->'+Cache.Org.getPartition('local.SATool').getAvgGetTime());
		System.debug('--getCapacity-->'+Cache.Org.getPartition('local.SATool').getCapacity());
		System.debug('--getKeys-->'+Cache.Org.getPartition('local.SATool').getKeys());
	*/
}
