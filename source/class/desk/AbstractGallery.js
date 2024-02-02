qx.Class.define("desk.AbstractGallery", {
  extend: qx.ui.window.Window,
  type: "abstract",

  construct(title, folder) {
    this.base(arguments, title);
    
    this.folder = folder;
    
    this.set({
      contentPadding: 0,
    //   showClose: false,
      showMinimize: false,
      width: 320,
      height: 400,
    });

    this.setLayout(new qx.ui.layout.Grow());
    this.moveTo(30, 50);
    this.open();

    this.itemHeight = 65;
    this.itemWidth = 70;
    this.itemCount = 431;
    this.itemPerLine = 1;
    // this.items = this._generateItems(this.itemCount);
    this.items = this._generateItems(this.folder);

    var scroller = this._createScroller();
    scroller.set({
      scrollbarX: "off",
      scrollbarY: "auto",
    });

    scroller.getPane().addListener("resize", this._onPaneResize, this);
    this.add(scroller);

    this.manager = new qx.ui.virtual.selection.CellRectangle(
      scroller.getPane(),
      this
    ).set({
      mode: "multi",
      drag: true,
    });

    this.manager.attachPointerEvents();
    this.manager.attachKeyEvents(scroller);
  },

  members: {
    folder : null,
    
    getItemData(row, column) {
      return this.items[row * this.itemPerLine + column];
    },

    _createScroller() {
      // abstract method
    },

    isItemSelectable(item) {
      return !!this.getItemData(item.row, item.column);
    },

    styleSelectable(item, type, wasAdded) {
      // abstract method
    },

    _onPaneResize(e) {
      var pane = e.getTarget();
      var width = e.getData().width;

      var colCount = Math.max(1, Math.floor(width / this.itemWidth));
      if (colCount == this.itemsPerLine) {
        return;
      }
      this.itemPerLine = colCount;
      var rowCount = Math.ceil(this.itemCount / colCount);

      pane.getColumnConfig().setItemCount(colCount);
      pane.getRowConfig().setItemCount(rowCount);
    },

    // _generateItems(count) {
    //   var items = [];
    //   var iconImages = [
    //     "folder.png",
    //     "user-trash.png",
    //     "network-server.png",
    //     "network-workgroup.png",
    //     "user-desktop.png",
    //     "file.png",
    //   ];

    //   var aliasManager = qx.util.AliasManager.getInstance();
    //   var resourceManager = qx.util.ResourceManager.getInstance();

    //   for (var i = 0; i < count; i++) {
    //     var icon =
    //       "icon/32/places/" +
    //       iconImages[Math.floor(Math.random() * iconImages.length)];
    //     var resolved = aliasManager.resolve(icon);
    //     var url = resourceManager.toUri(resolved);

    //     items[i] = {
    //       label: "Icon #" + (i + 1),
    //       icon: icon,
    //       resolvedIcon: url,
    //     };
    //   }

    //   return items;
    // },
    
    _generateItems(folder) {
        var files = folder.getChildren().toArray();
        
        var aliasManager = qx.util.AliasManager.getInstance();
        var resourceManager = qx.util.ResourceManager.getInstance();
        
        var items = files.map((file) => {
            var name = file.getName();
            var icon;
            
            if(file.getChildren) {
                icon = "icon/22/places/folder.png";
            } else {
                icon = "icon/22/mimetypes/office-document.png";
            }
            
            var resolved = aliasManager.resolve(icon);
            var url = resourceManager.toUri(resolved);
            
            var item = {
                label: name,
                icon: icon,
                resolvedIcon: url,
            };
            return item;
        });

        return items;
        
    }
  },

  destruct() {
    this.items = null;
    this._disposeObjects("manager");
  },
});