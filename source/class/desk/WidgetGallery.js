qx.Class.define("desk.WidgetGallery", {
  extend: desk.AbstractGallery,

  construct(title, folder) {
    this.base(arguments, title, folder);
    this.__cell = new desk.GalleryCell();
  },

  members: {
    __cell: null,

    _createScroller() {
      var scroller = new qx.ui.virtual.core.Scroller(
        1,
        this.itemPerLine,
        this.itemHeight,
        this.itemWidth
      );

      this.layer = new qx.ui.virtual.layer.WidgetCell(this);
      scroller.getPane().addLayer(this.layer);

      // Creates the prefetch behavior
      new qx.ui.virtual.behavior.Prefetch(scroller, {
        minLeft: 0,
        maxLeft: 0,
        minRight: 0,
        maxRight: 0,
        minAbove: 200,
        maxAbove: 300,
        minBelow: 600,
        maxBelow: 800,
      }).set({
        interval: 500,
      });

      return scroller;
    },

    styleSelectable(item, type, wasAdded) {
      if (type !== "selected") {
        return;
      }

      var widgets = this.layer.getChildren();
      for (var i = 0; i < widgets.length; i++) {
        var widget = widgets[i];
        var cell = widget.getUserData("cell");

        if (item.row !== cell.row || item.column !== cell.column) {
          continue;
        }

        if (wasAdded) {
          this.__cell.updateStates(widget, { selected: 1 });
        } else {
          this.__cell.updateStates(widget, {});
        }
      }
    },

    getCellWidget(row, column) {
      var itemData = this.getItemData(row, column);

      if (!itemData) {
        return null;
      }

      var cell = { row: row, column: column };
      var states = {};
      if (this.manager.isItemSelected(cell)) {
        states.selected = true;
      }

      var widget = this.__cell.getCellWidget(itemData, states);
      widget.setUserData("cell", cell);

      return widget;
    },

    poolCellWidget(widget) {
      this.__cell.pool(widget);
    },
  },

  /*
   *****************************************************************************
      DESTRUCT
   *****************************************************************************
   */

  destruct() {
    this._disposeObjects("__cell", "layer");
  },
});

// new desk.WidgetGallery("Gallery (widgets)");