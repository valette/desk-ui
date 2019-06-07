/**
 * A file tail display class
 */
qx.Class.define("desk.FileTail", 
{
	extend : desk.LogContainer,

    /**
    * Constructor
    */
	construct : function ( file ) {
		this.base(arguments);
        this.setBackgroundColor('black');
		this.clear();
        var win = new qx.ui.window.Window( );
		win.set({ layout : new qx.ui.layout.HBox(),
			width : 500,
			height : 600,
			showClose :true,
			showMinimize : false,
			useMoveFrame : true,
			caption : file });
        win.add( this, {flex : 1} );

        var action = desk.Actions.execute( {

            action : "tail",
            follow : true,
            file : file
        },{
            listener : function (message) {

				if (message.type === "outputDirectory") {
					return;
				}

				var color;
				switch (message.type) {
					case "stdout" : 
						color = 'white';
						break;
					case "stderr" : 
						color = 'red';
						break;
					default : return;
				}
				this.log(message.data, color);
			}.bind( this )

        } );

        win.open();
        win.center();
        win.addListener( 'close' , function () {
           desk.Actions.killAction( action ); 
        } );
	}

} );
