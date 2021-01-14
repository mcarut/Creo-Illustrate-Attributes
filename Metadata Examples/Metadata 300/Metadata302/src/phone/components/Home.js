// $scope, $element, $attrs, $injector, $sce, $timeout, $http, $ionicPopup, and $ionicpopup services are available

$scope.$on('userpick', function (event, targetName, targetType, eventData) {
  //
  //Look at model and see if it has metadata. If it does, then execute the below code and create an object called metadata
  PTC.Metadata.fromId(targetName)
      .then((metadata) => {
    //
    // variable to pull the value for the occurrence property in the eventData JSON object from the model. Create variable for the currently selected part
    var pathId = JSON.parse(eventData).occurrence
    $scope.currentSelection = targetName + "-" + pathId
     
    //create an object with the properties below that are based on attribute names from Creo Illustrate for this model. use metadata.get to obtain the data from the JSON properties for this occurrence.
    $scope.meta = {
      partName: metadata.get(pathId, 'Display Name'),
      instructionName : metadata.get(pathId, 'illustration'),
      partNumber: metadata.get(pathId, 'partNumber'),
    } //scope.meta object
   
    // set itemName app parameter to be equal to the partName variable, same relationship with itemNumber and partNumber. Set the itemCount to 1 for the purpose of this section.
    $scope.app.params.itemName = $scope.meta.partName;
    $scope.app.params.itemNumber = $scope.meta.partNumber;
    $scope.app.params.itemCount = 1;
    
    $scope.target = targetName
    
    // call the getPriceAvailability ThingWorx service based on partNumber
    twx.app.fn.triggerDataService('shoppingThing', 'getPriceAvailability', {pid: $scope.meta.partNumber})
    
    }) //end brackets for PTC API and .then 
  //
  //catch statement if the promise of having a part with metadata is not met
  .catch((err) => { console.log('metadata extraction failed with reason : ' + err) })

}) //end brackets for userpick function. Will continue to move throughout code

$scope.$on('getPriceAvailability.serviceInvokeComplete', function(evt) {  
  //
  // variable holding all data for the current row in the infotable
  var rowData = twx.app.mdl['shoppingThing'].svc['getPriceAvailability'].data.current
  
  // price is going to be the variable that is referenced in the popup, while the app parameter priceInfo will be used for adding the total in the cart
  var price = rowData.avail === true ? '$' + rowData.price : 'UNAVAILABLE';
  $scope.app.params.priceInfo = rowData.avail === true ? parseFloat(rowData.price) : undefined
  
  // create a variable to bring the $scope.meta object into this event listener as a local object
  let meta = $scope.meta
  
  // adds an ionic popup when a part is clicked
  $scope.popup = $ionicPopup.show({
    //
    //call the function for setting the template
    template: $scope.setTemplate(meta, price),
    //
    // set the scope for the popup
    scope: $scope

  }); //end of ionic popup 

  //highlight the chosen item and set the shader to true
  $scope.hilite([$scope.currentSelection], true);

  //function for removing the highlight
  $scope.hiliteOff = function() {
   $scope.hilite([$scope.currentSelection], false)
  }; // end of hiliteOff function

  // function to be bound to the Disassemble button in the popup
  $scope.disassemble = function () {
    //
    // set an object that targets the model and its instruction property
    var modelObject = { model: $scope.target, instruction: 'l-Creo 3D - ' + meta.instructionName + '.pvi' };
    //
    // set the sequence for the quadcopter to be the name of the associated instruction
    $scope.view.wdg.quadcopter.sequence = modelObject.instruction
  } //disassemble function end

}) // getPriceAvailability end
//function for using the userInput text box to search for parts
$scope.findMeta = function () {
  //
  //set a variable for comparing the user input to the value of the partno application parameter
  var searchNum = $scope.app.params.partno;

  //
  // instead of using metadata from just the picked part, use metadata from the whole model. If resolved, proceed
  PTC.Metadata.fromId('quadcopter')
    .then((metadata) => {
        //
        // set a variable named options. this variable will become an array of ID paths that fit the input text.
        // 'like' will look for a partial text match to what is typed in. use 'same' to get an exact match 
        var options = metadata.find('partNumber').like(searchNum).getSelected();

        //
        // if the text input leads to a part number so that there is an entry in the options array
        if (options != undefined && options.length > 0) {
            //
            // set an empty array called ID. This array will house the parts that contain the entered part number
            var identifiers = []
            //
            // for each entry in the options array, push that value with 'quadcopter-' at the beginning into the ID array 
            options.forEach(function (i) {
                identifiers.push('quadcopter-' + i)
            }) //end forEach

            //
            // highlight each object in the identifiers array with the shader
            $scope.hilite(identifiers, true)

            //
            // function for removing the highlight
            var removeHilite = function (refitems) {
                //
                // return the hilite function with a value of false to the given part(s)
                return function () {
                    $scope.hilite(refitems, false)
                } // end of return function
            } // end of turning off hilite

            //
            // remove the highlight of the selected part(s) after 3000 ms
            $timeout(removeHilite(identifiers), 3000)

          } //end if statement 
    }) // end .then

      //catch statement if the promise of having a part with metadata is not met
      .catch((err) => { console.log('metadata extraction failed with reason : ' + err) })
} // end findMeta function

//sequenceloaded event listener triggers when the sequence property is updated
$scope.$on('sequenceloaded', function (event) {
    //
    // call a widget service to trigger the quadcopter model to play all steps for the given sequence
    twx.app.fn.triggerWidgetService('quadcopter', 'playAll');
}); //serviceloaded event function end

//resetit function
$scope.resetit = function () {
    //
    //set the sequence property of the quadcopter model to blank
    $scope.view.wdg.quadcopter.sequence = ''
}//resetit function end

//highlight function. Inputs are the selected part and a boolean for hilite
$scope.hilite = function (items, hilite) {
    //
    //iterate over each item that is used as an imported variable for the function using .forEach to look at each value that comes in the items input
    items.forEach(function (item) {
        //
        //set the properties of the TML 3D Renderer to highlight the selected item using a TML Text shader. "green" is the name of the script for the TML Text.
        tml3dRenderer.setProperties(item, hilite === true ? { shader: "green", hidden: false, opacity: 0.9, phantom: false, decal: true }
            : { shader: "Default", hidden: false, opacity: 1.0, phantom: false, decal: false });
    }) //foreach function end
} //hilite function end

$scope.app.params.cartButton = "Cart"; // set cartButton app parameter to be "Cart". This will bind to the Text property for the buttonCart button
$scope.cart = {}; // declare empty object called cart

// function for adding a selected part to the cart   
$scope.addToCart = function () {
  //
  /* create variable called cartItem that is equal to the value of the currentSelection property of the cart object. If the selected part hasn't been added to the cart yet, then the cartItem variable will be undefined and populate the cartItem variable with the current information about the part so that cartItem becomes an object. If the selected part has already been added, then the count property of cartItem will increase by the item count*/
  //
  var cartItem =$scope.cart[$scope.currentSelection];
  
  if (cartItem === undefined) {
  	cartItem = { count: $scope.app.params.itemCount, itm: $scope.app.params.itemNumber, tag: $scope.app.params.itemName, prc: $scope.app.params.priceInfo }
  } else {
    cartItem.count += $scope.app.params.itemCount}
  
  $scope.cart[$scope.currentSelection] = cartItem;
  
  //cartItemAmount initialized as 0. will be used to count how many items are in the cart
  var cartItemAmount = 0;
  
  // set an empty array for the cart. this array will have an object pushed into it 
  var cartContents = [];
  
  // initialize variable for keeping track of the price of the objects in the cart
  var cartPrice = 0;
  
    //loop over each item that is added to the cart
  for (var itm in $scope.cart) {
    //
    //add a number to the counting variable for each item added
    cartItemAmount += $scope.cart[itm].count;
    //
    // add the price of each item to the total price of the cart
    cartPrice = cartPrice += $scope.cart[itm].count*$scope.cart[itm].prc
    
    //push the name (tag), item count (count), and price (prc) of each part into the repeater for the cart
    cartContents.push({ 
        tag: $scope.cart[itm].tag, 
        count: $scope.cart[itm].count, 
        prc: $scope.cart[itm].prc
    }); // end of the push method for cartContents
  }// for loop end
  
  // set the app parameter for cart to be equal to the cartContents array
  $scope.app.params.cart = cartContents;
  
  //setting the cartButton app parameter. if there are items to put into the cart (true), the text of the cart button should be cart(total cost of cart). If false, just keep the button text as cart
  $scope.app.params.cartButton = cartItemAmount > 0 ? "Cart($" + cartPrice + ")" : "Cart";
  //remove the highlight from the part

} //end of addToCart function

//
// clear the cart. set the part app parameter and cart object to be empty. change the text on the cart button back to just Cart
$scope.clearCart = function () {
    $scope.app.params.cart = [];
    $scope.cart = {};
    $scope.app.params.cartButton = "Cart";
} // end of clearCart function

//function for ordering. Will be populated more when connected to ThingWorx
$scope.orderCart = function () {
  $scope.clearCart();
} // end of orderCart function

// function for setting the template for the Ionic popup
$scope.setTemplate = function (meta, price) {
  // if there is a disassembly sequence associated with the part, create a Disassemble button in the popup, if not, no button will appear
  var instr = meta.instructionName.length > 0 ? '<div class="btndisassemble" ng-click="hiliteOff();popup.close();disassemble();">Disassemble</div>' : 
  '';
  
  // if price != unavailable, define an add to cart button and have the price displayed in the popup, if it is unavailable, just display price
  var addTo = price != 'UNAVAILABLE' ? price + '&nbsp;</div><div class="btnadd" ng-click="hiliteOff();popup.close();addToCart();">Add to Cart</div>' : 
  price ;
  
  // build the template for the popup
  var template = '<div>' + $scope.app.params.itemCount + 'x &nbsp;' + meta.partNumber + '&nbsp;</br>' + 
                 meta.partName + '&nbsp;</br>' + 
                 addTo  +
                 instr +
                 '<div class="btncontinue" ng-click="hiliteOff();popup.close();">Continue</div>' ;
  
  // return the template variable when this function is called
  return template
}