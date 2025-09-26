document.addEventListener('DOMContentLoaded', function() {

    /* initialize the external events
    -----------------------------------------------------------------*/

    let containerEl = document.getElementById('external-events-list');
    new FullCalendar.Draggable(containerEl, {
      itemSelector: '.fc-event',
      eventData: function(eventEl) {
        return {
          title: eventEl.innerText.trim()
        }
      }
    });

    // ============= Custom Date ================ //
    let sidValue = 0;
    $(document).on("click", '#service_calendar', function(){
        sidValue = $(this).data("sid");
        initializeCalendar();
    });

    async function initializeCalendar() {
        try {
            let calendarEl = document.getElementById('calendar');
            
            // Initialize FullCalendar with dynamically populated events
            let calendar = new FullCalendar.Calendar(calendarEl, {
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
                },
                initialView: 'dayGridMonth',
                initialDate: new Date(),
                navLinks: true,
                selectable: true,
                nowIndicator: true,
                events: async (info, successCallback, failureCallback) => {
                    try {
                        const fetchedData = []
                        const events = fetchedData.map(item => ({
                            title: item.title,
                            start: item.start,
                            end: item.end
                        }));
                        successCallback(events);
                    } catch (error) {
                        failureCallback(error);
                    }
                },
                droppable: true,
                drop: function(arg) {
                    // is the "remove after drop" checkbox checked?
                    if (document.getElementById('drop-remove').checked) {
                        // if so, remove the element from the "Draggable Events" list
                        arg.draggedEl.parentNode.removeChild(arg.draggedEl);
                    }
                }
            });
          
            calendar.render();
        } catch (error) {
            // Handle errors here
            console.error('Error initializing calendar:', error);
        }
    }

    initializeCalendar();

  });