public with sharing class SATController {
    private static Cache.OrgPartition satPart = Cache.Org.getPartition('local.SATool');

    @AuraEnabled(Cacheable=true)
    public static List<Map<String, String>> getSobjList() {
        List<String> objList = new List<String>();
        objList = (List<String>)satPart.get('sobjs');
        // Check the cache value that the get() call returned.
        if (objList!=null&&!objList.isEmpty()) {
            return objList;
        }
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
        objNameSet.addAll(SATConstants.standardObjs);
        String[] sortedSobjList = new String[0];
        sortedSobjList.addAll(objNameSet);
        sortedSobjList.sort();
        satPart.put('sobjs', sortedSobjList);
        return sortedSobjList;
    }

    private List<Map<String, String>> transformToListOfMap(Sobject[] sobjs, String valueAPIName, String labelAPIName){
        List<Map<String, String>> retList = new List<Map<String, String>>();
        for(Sobject sobj: sobjs){
            retList.add(new Map<String,String>{'value' => (String)sobj.get(valueAPIName), 'label' => (String)sobj.get(labelAPIName)});
        }
        return retList;
    }

    @AuraEnabled(Cacheable=true)
    public static List<Map<String, String>> getProfiles() {
        return transformToListOfMap([SELECT Id,Name FROM Profile
        WHERE UserLicense.Name = 'Salesforce'
        WITH SECURITY_ENFORCED], 'Id','Name');
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
}
