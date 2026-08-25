Figma AI Prompt – Administrator Portal Enhancement (Machine Allocation & Unit Management)

Update only the Administrator Portal of the existing Dialysis Slot Manager application. Do not modify or affect the Patient Portal or Doctor Portal. Preserve the existing UI theme, navigation, database structure, and all current functionality. Only enhance the Machine Assignment and Machine Management modules as described below.

1. Machine Assignment Workflow Enhancement

Enhance the Assign Patient to Dialysis Machine workflow by introducing a Unit Selection step before selecting a machine.

Step 1 – Select Patient

Display the existing patient selection interface with:

Patient Name
UHID / Patient ID
Viral Status
Blood Group
Current Treatment Status
Last Dialysis Date
Step 2 – Select Dialysis Unit

Before displaying available machines, provide a dropdown or card selection for the dialysis unit.

Available Units:

Unit 1
Unit 2

The administrator must select a unit before machine selection.

Step 3 – Display Machines Based on Selected Unit

Once a unit is selected, display only the machines belonging to that unit.

Unit 1 Configuration

Total Machines: 29

Machine Categories:

1 × RVD (HIV) Machine
1 × HBsAg Machine
5 × HCV Machines
22 × Negative Machines

Display machine cards similar to:

Machine No.	Type	Status
Machine 01	Negative	Available
Machine 02	Negative	Occupied
Machine 03	HCV	Available
Machine 04	HBsAg	Maintenance
Machine 05	RVD (HIV)	Available
Unit 2 Configuration

Total Machines: 7

Machine Categories:

5 × Negative Machines
1 × HCV Machine
1 × HIV Machine

Display them using the same machine card layout.

Machine Card Design

Each machine card should display:

Machine Number
Unit Number
Machine Type
Current Status
Current Patient (if occupied)
Next Scheduled Patient
Next Available Time

Machine Status Colors

🟢 Available

🔵 In Use

🟡 Reserved

🔴 Under Maintenance

⚫ Disabled

Machine Selection Rules

Administrator can only assign patients to:

Available machines
Machines belonging to the selected unit
Machines compatible with the patient's viral status

The system should automatically warn if an incompatible machine is selected.

Examples:

HCV-positive patients should preferably be assigned to HCV-designated machines.
Hepatitis B-positive patients should be assigned to HBsAg-designated machines.
HIV-positive patients should be assigned to HIV/RVD-designated machines.
Negative patients should be assigned to Negative machines.

If no dedicated machine is available, display a warning and allow assignment only if permitted by hospital policy.

2. Future-Proof Machine Management

Update the Machines section of the Administrator Portal so administrators can modify machine inventory without requiring developer changes.

Add the following features:

Add New Machine

Administrator should be able to create a new machine by entering:

Machine Number
Unit
Machine Category
Machine Name
Status
Notes
Machine Categories

Allow selection from:

Negative
HCV
HBsAg
HIV
RVD (HIV)
Other (Custom)
Add New Machine Types

Administrator should be able to create new machine categories in the future.

Example:

Isolation Machine
Pediatric Machine
Emergency Machine

The system should automatically make newly created categories available during machine assignment.

Increase Existing Machine Count

Provide an easy interface for administrators to increase the number of machines.

Example:

Current

Negative Machines (22)

Administrator clicks:

➕ Add Machine

The system automatically creates:

Negative Machine 23

The administrator can edit its machine number if required.

Edit Machine Details

Allow editing:

Machine Number
Unit
Machine Category
Status
Maintenance Notes
Disable Machine

Administrator can mark a machine as:

Under Maintenance
Disabled
Active

Disabled machines should never appear during patient assignment.

3. Dialysis Slot Timing Update

Update the scheduling module.

Remove the existing four-shift schedule.

Replace it with three fixed dialysis sessions.

Available Slots:

08:00 AM – 12:00 PM
12:00 PM – 04:00 PM
04:00 PM – 08:00 PM

These should appear as selectable options throughout the Administrator Portal wherever dialysis sessions are created or edited.

4. Dashboard Updates

Update dashboard statistics to include:

Total Machines in Unit 1
Total Machines in Unit 2
Machines Available by Unit
Machines Under Maintenance
Unit-wise Dialysis Count
Machine Utilization by Unit
5. Search & Filters

Add filters in the Machines page:

Unit
Machine Type
Machine Status
Availability

Add filters in Machine Assignment:

Unit
Machine Type
Viral Compatibility
Available Only
6. Scalability Requirements

Design the database and UI so the hospital can:

Add additional dialysis units in the future (e.g., Unit 3, Unit 4) without changing application code.
Add or remove machines dynamically.
Create new machine categories.
Configure machine counts from the Administrator Portal only.
Automatically reflect these changes throughout scheduling, machine assignment, and dashboard reports.
7. Design Requirements
Modify only the Administrator Portal.
Do not change the Patient Portal or Doctor Portal.
Maintain the existing hospital-themed design, navigation, color palette, and responsive layout.
Ensure all new functionality integrates seamlessly with the current application without breaking existing workflows.
Keep the interface intuitive, allowing administrators to assign patients to the correct unit, machine type, and time slot while supporting future expansion without code changes.