public with sharing class SATController {
    private static Cache.OrgPartition satPart = Cache.Org.getPartition('local.SATool');

    @AuraEnabled(Cacheable=true)
    public static SystemVars getSystemVars() {
        SystemVars s = new SystemVars();
        s.baseURL = Url.getOrgDomainUrl().toExternalForm();
        return s;
    }
    //
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
    private static List<Map<String, String>> transformToListOfMap(Sobject[] sobjs, String valueAPIName, String labelAPIName){
        List<Map<String, String>> retList = new List<Map<String, String>>();
        for(Sobject sobj: sobjs){
            retList.add(new Map<String,String>{'value' => (String)sobj.get(valueAPIName), 'label' => (String)sobj.get(labelAPIName)});
        }
        return retList;
    }

    @AuraEnabled(Cacheable=true)
    public static List<Map<String, String>> getProfiles() {
        return transformToListOfMap(
            [SELECT Id,Name FROM Profile
            //WHERE UserLicense.Name = 'Salesforce'
            WITH SECURITY_ENFORCED],
            'Id','Name');
    }

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
