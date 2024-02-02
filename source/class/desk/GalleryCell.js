qx.Class.define("desk.GalleryCell", {
  extend: qx.ui.virtual.cell.AbstractWidget,

  members: {
    _createWidget() {
      var widget = new qx.ui.basic.Atom().set({
        iconPosition: "top",
      });

      widget.getChildControl("label").set({
        padding: [0, 4],
      });

      widget.getChildControl("icon").set({
        padding: 4,
      });

      return widget;
    },

    updateData(widget, data) {
      widget.set({
        icon: data.icon,
        label: data.label,
      });
    },

    updateStates(widget, states) {
      var label = widget.getChildControl("label");
      var icon = widget.getChildControl("icon");

      if (states.selected) {
        label.setBackgroundColor("background-selected");
        label.setTextColor("text-selected");
        icon.setDecorator("white-box");
        icon.setBackgroundColor("background");
      } else {
        label.resetBackgroundColor();
        label.resetTextColor();
        icon.resetDecorator();
        icon.resetBackgroundColor();
      }
    },
  },
});
