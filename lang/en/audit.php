<?php

return [
    'navigation' => [
        'label' => 'Audits',
        'group' => 'Foundations',
    ],
    'breadcrumb' => [
        'title' => 'Audits',
    ],
    'model' => [
        'label' => 'Audit',
        'plural_label' => 'Audits',
    ],
    'table' => [
        'empty_state' => [
            'heading' => 'No Audits Created',
            'description' => 'Try creating a new audit by clicking the "Create an Audit" button above to get started!',
        ],
        'columns' => [
            'title' => 'Title',
            'audit_type' => 'Audit Type',
            'status' => 'Status',
            'manager' => 'Manager',
            'start_date' => 'Start Date',
            'end_date' => 'End Date',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
            'department' => 'Department',
            'scope' => 'Scope',
            'not_assigned' => 'Not assigned',
            'unassigned' => 'Unassigned',
        ],
        'filters' => [
            'manager' => 'Manager',
            'status' => 'Status',
            'department' => 'Department',
            'scope' => 'Scope',
        ],
    ],
    'infolist' => [
        'section' => [
            'title' => 'Audit Details',
        ],
    ],
    'actions' => [
        'create' => 'Create Audit',
    ],
    
    // Edit Audit Form
    'edit' => [
        'section_title' => 'Edit Audit Details',
        'title' => 'Title',
        'title_hint' => 'Give the audit a distinctive title.',
        'title_placeholder' => '2023 SOC 2 Type II Audit',
        'audit_manager' => 'Audit Manager',
        'audit_manager_hint' => 'Who will be managing this audit?',
        'additional_members' => 'Additional Members',
        'additional_members_hint' => 'Who else should have full access to the Audit?',
        'additional_members_helper' => 'Note: You don\'t need to add evidence people who are only fulfilling requests here.',
        'description' => 'Description',
        'start_date' => 'Start Date',
        'end_date' => 'End Date',
        'department' => 'Department',
        'scope' => 'Scope',
    ],
    
    // Create Audit Wizard
    'wizard' => [
        'steps' => [
            'audit_type' => 'Audit Type',
            'basic_information' => 'Basic Information',
            'audit_details' => 'Audit Details',
        ],
        'audit_type' => [
            'introduction' => 'There are two Audit Types to choose from:',
            'select_type' => 'Select Audit Type',
            'standards' => [
                'title' => 'Standards Audit',
                'description' => 'This audit type is used to check the compliance of the organization with a specific standard. The standard is selected from the list of standards available in the system. The audit will be performed against the controls specified in the selected standard.',
                'note' => 'Note: The standard must be set to In Scope first.',
                'label' => 'Standards Audit',
            ],
            'implementations' => [
                'title' => 'Implementations Audit',
                'description' => 'This kind of audit is used to audit the implementations of controls in your organization. Implementations are selected from your total list of implemented controls and setup for audit.',
                'label' => 'Implementations Audit',
            ],
            'program' => [
                'label' => 'Program Audit',
            ],
            'standard_to_audit' => 'Standard to Audit',
            'program_to_audit' => 'Program to Audit',
        ],
        'basic_info' => [
            'title' => 'Title',
            'title_hint' => 'Give the audit a distinctive title.',
            'title_placeholder' => '2023 SOC 2 Type II Audit',
            'audit_manager' => 'Audit Manager',
            'audit_manager_hint' => 'Who will be managing this audit?',
            'description' => 'Description',
            'start_date' => 'Start Date',
            'end_date' => 'End Date',
            'department' => 'Department',
            'scope' => 'Scope',
        ],
        'details' => [
            'controls' => 'Controls',
            'available_items' => 'Available Items',
            'selected_items' => 'Selected Items',
        ],
    ],
];
