qx.Class.define("desk.FileBrowser2", 
{
  extend: qx.ui.window.Window,

  construct: function() {
    this.base(arguments, "File Explorer");

    // Layout for the window
    var layout = new qx.ui.layout.VBox();
    this.setLayout(layout);

    // Toolbar for navigation buttons and search
    var toolbar = new qx.ui.toolbar.ToolBar();
    this.add(toolbar);

    // Create navigation buttons (prev and next)
    var prevButton = new qx.ui.toolbar.Button("<");
    var nextButton = new qx.ui.toolbar.Button(">");
    toolbar.add(prevButton);
    toolbar.add(nextButton);
    
    // Create a toolbar part for the folder path
    var pathPart = new qx.ui.toolbar.Part();
    toolbar.add(pathPart);
    var parentMap = new Map();
    
    // // Create a spacer to push the search bar to the right
    // toolbar.addSpacer();

    // // Create a search bar
    // var searchBar = new qx.ui.form.TextField().set({
    //   placeholder: "Search...",
    //   visibility: "excluded",  // Initially hidden
    //   marginLeft: 4
    // });
    // toolbar.add(searchBar);
    
    // // Create a button with a magnifying glass icon to trigger the search bar
    // var searchButton = new qx.ui.toolbar.Button(null, "icon/22/actions/system-search.png");
    // toolbar.add(searchButton);

    // // Event listener to toggle the visibility of the search bar
    // searchButton.addListener("execute", function() {
    //   searchBar.setVisibility(searchBar.getVisibility() === "visible" ? "excluded" : "visible");
    //   searchBar.focus();
    // });
    
    // Create a search bar
    var searchBar = new qx.ui.form.TextField().set({
      placeholder: "Search...",
      marginLeft: 4
    });
    toolbar.addSpacer();
    toolbar.add(searchBar);
    
    // Function to recursively search for files
    function searchFiles(node, query) {
      let matchingFiles = [];
    
      // Check if the current node matches the query
      if (node.get("label").includes(query)) {
        matchingFiles.push(node);
      }
    
      // Recursively search the children of the node
      if (typeof node.getChildren === "function" ) {
          let children = node.get("children");
          if (children) {
            children.toArray().forEach(function(child) {
              matchingFiles = matchingFiles.concat(searchFiles(child, query));
            });
          }
      }
    
      return matchingFiles;
    }
    
    // Add an input event listener to the search bar
    searchBar.addListener("input", function(e) {
      let query = e.getData();
    
      // Clear the existing results
      rightContainer.removeAll();
    
      // Search for files that match the query
      let matchingFiles = searchFiles(model, query);
    
      // Display the matching files
      matchingFiles.forEach(function(file) {
        let label = new qx.ui.basic.Label(file.get("label"));
        rightContainer.add(label);
      });
    });

    // Create an HBox for the main content
    var mainContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox());
    this.add(mainContainer, { flex: 1 });

    // Create a VBox for the left side (tree view)
    var leftContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox());
    // leftContainer.set({
    //     height: 700
    // });
    
    mainContainer.add(leftContainer, { 
      flex: 1

    });

    // Create the model
    let model = qx.data.marshal.Json.createModel({
      label: "root",
      date: "2003-01-02",
      children: [
        {label: "Desktop"},
        {label: "Home"},
        {
          label: "Filesystem",
          children: [
            {label: "C:",
             date: "2002-03-16"
            },
            {label: "D:",
             date: "2022-02-17"
            },
            {
                label: "B:",
                date: "2004-03-02",
                children: [
                    {label: "fileB.txt",
                     date: "2012-03-16"
                    },
                    {label: "fileA.txt",
                     date: "2014-07-16"
                    }
                ]
            }
          ]
        }
      ]
    }, true);
    
    // Create the tree
    let tree = new qx.ui.tree.VirtualTree(model, "label", "children");
    
    // Add the tree to the VBox
    leftContainer.add(tree);
    
    tree.addListener("open", function (e) {
        var selectedItem = tree.getSelection().getItem(0); // Assuming single selection
        console.log(selectedItem);
        console.log(new qx.ui.tree.TreeFolder());
        if (selectedItem instanceof qx.ui.tree.TreeFolder) {
            // Handle the selected folder
            console.log("Selected Folder:", selectedItem.getLabel());
        }
    }, this);
    
    tree.setDelegate({
        configureItem: function(item) {
            var img = new qx.ui.basic.Image(
              "icon/16/status/dialog-information.png"
            );
            item.addWidget(img);
        }
    });

    // Create a VBox for the right side (detail view)
    var rightContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox());
    mainContainer.add(rightContainer, { flex: 3 });

    // Create the table model
    let tableModel = new qx.ui.table.model.Simple();
    // tableModel.setColumns(["Name", "Date", "Type", "Size"]);
    tableModel.setColumns(["Name", "Date"]);
    // console.log(new Date("2002-03-16"));
    // Set the comparator for the Date column
    tableModel.setSortMethods(1, function(row1, row2) {
        let date1 = new Date(row1[1]);
        let date2 = new Date(row2[1]);
        return date1.getTime() - date2.getTime();
    });

    // Create the table
    let table = new qx.ui.table.Table(tableModel);
    table.set({
      columnVisibilityButtonVisible: false,
      statusBarVisible: false
    });
    
    // Add a custom cell renderer for the "Name" column
    // table.getTableColumnModel().setDataCellRenderer(0, new qx.ui.table.cellrenderer.Abstract((cellInfo) => {
    //     console.log(cellInfo);
    //     return cellInfo;
    // }));
    //     let name = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
    //     let label = cellInfo.get("label");
    //     let type;
    //     if (typeof cellInfo.getChildren === "function" ) {
    //         type = "folder";
    //     } else {
    //         type = "file";
    //     }
        
    //     let icon = new qx.ui.basic.Image("../../source/resource/desk/folder_icon.png");
    //     name.add(icon);
        
    //     let nameLabel = new qx.ui.basic.Label(label);
    //     name.add(nameLabel);
    
    //     return name;
    // }));
    // let icon = new qx.ui.basic.Image("../../source/resource/desk/folder_icon.png");
    // console.log(icon);
    
    // Function to create a tree for a file
    function createFileTree(file) {
      // Create a tree
      let tree = new qx.ui.tree.VirtualTree(file, "label", "children");
    
      // Set the delegate to create a composite for each node
      tree.setDelegate({
        createItem: function() {
          return new qx.ui.tree.VirtualTreeItem();
        },
        bindItem: function(controller, item, id) {
          controller.bindDefaultProperties(item, id);
          controller.bindProperty("", "model", null, item, id);
        },
        configureItem: function(item) {
          let model = item.getModel();
          let iconSource;
          if (model.getChildren) {
            iconSource = "../../source/resource/desk/folder_icon.png";
          } else if (model.getLabel().endsWith(".js")) {
            iconSource = "../../source/resource/desk/folder_icon.png";
          } else {
            iconSource = "../../source/resource/desk/folder_icon.png";
          }
          item.setIcon(iconSource);
        }
      });
    
      return tree;
    }
    
    // Function to add a file to the table
    function addFileToTable(file) {
      // Create a tree for the file
      let tree = createFileTree(file);
    
      // Add a row to the table for the file
    //   tableModel.addRows([[tree, file.getDate(), file.getType(), file.getSize()]]);
        tableModel.addRows([[tree, file.getDate()]]);
    }
    
    // Add the files to the table
    // model.forEach(addFileToTable);

    rightContainer.add(table, {flex: 1});
    
    // Function to populate the parent map
    function populateParentMap(node, parent) {
      parentMap.set(node, parent);
      if (typeof node.getChildren === "function" ) {
          let children = node.get("children");
          if (children) {
            children.toArray().forEach(function(child) {
              populateParentMap(child, node);
            });
          }
      }
    }
    
    // Populate the parent map
    populateParentMap(model, null);
    
    // Add a selection change listener to the tree
    tree.getSelection().addListener("change", function(e) {
        // Get the selected folder
        let selectedFolder = tree.getSelection().getItem(0);
        // let selectedFolder = e.getItem(0);
        // console.log(e);
        // console.log(tree.getSelection());
        
        if (typeof selectedFolder.getChildren === "function" ) {
            // Get the files in the selected folder
            let files = selectedFolder.get("children").toArray();
            // console.log(files);
        
            // Update the table
            let rowData = files.map(function(file) {
                return [file.get("label"), file.get("date")];
            });
            tableModel.setData(rowData);
        }
        // Update the folder path
        updateFolderPath(selectedFolder);
    });
    
    // Function to update the folder path
    function updateFolderPath(folder) {
        // Clear the existing path
        pathPart.removeAll();
    
        // Get the path to the folder
        let path = [];
        while (folder) {
            path.unshift(folder.get("label"));
            folder = parentMap.get(folder);
        }
    
        // Add a button for each part of the path
        path.forEach(function(part, index) {
            let button = new qx.ui.toolbar.Button(part);
            pathPart.add(button);
    
            // Add a click listener to the button
            button.addListener("execute", function() {
                let selectedFolder;
                for (let [key, value] of parentMap.entries()) {
                    if (key.getLabel() === part) {
                        selectedFolder = key;
                    }
                }
                tree.setSelection([selectedFolder]);
            });
    
            // Add a separator after the button, except for the last one
            if (index < path.length - 1) {
                pathPart.add(new qx.ui.toolbar.Separator());
            }
        });
    }

    // Open the window
    this.set({
      width: 800,
      height: 500,
      showMinimize: false,
      resizable: true,
    });

    this.open();
  },

    // destruct : function() {

    // },

  members : {
    __window : null,
    // __layout : null,
    
    __createTreeColumns : function () {
        var scroller = new qx.ui.container.Scroll();
        var container = new qx.ui.container.Composite(new qx.ui.layout.Basic());
        container.setAllowGrowX(false);
        container.setAllowStretchX(false);
        scroller.add(container);
        
        
        
        return scroller;
    },
    
    __configureTreeItem(treeItem, vLabel, vIcon) {
        
    }
  }
});

new desk.FileBrowser2();
