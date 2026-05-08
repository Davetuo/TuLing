## ADDED Requirements

### Requirement: Back button is displayed in chat header
The system SHALL display a back-to-home button at the leftmost position of the chat header area, before any other header elements (sidebar toggle, title).

#### Scenario: Back button visible on page load
- **WHEN** user navigates to the chat page
- **THEN** a back button with a left-arrow icon SHALL be visible in the top-left area of the chat header

#### Scenario: Back button visible regardless of sidebar state
- **WHEN** sidebar is collapsed or expanded
- **THEN** the back button SHALL remain visible and accessible

### Requirement: Back button navigates to home page
The system SHALL navigate the user to the home page when the back button is clicked.

#### Scenario: Click back button navigates to home
- **WHEN** user clicks the back button
- **THEN** the application SHALL navigate to the Home route (`/home`)
- **AND** the browser history SHALL allow forward navigation back to the chat page

#### Scenario: Click back button during active session
- **WHEN** user has an active chat session and clicks the back button
- **THEN** the application SHALL navigate to home without data loss
- **AND** the session SHALL remain accessible when user returns to chat

### Requirement: Back button provides hover tooltip
The system SHALL display a tooltip with text "返回首页" when the user hovers over the back button.

#### Scenario: Tooltip on hover
- **WHEN** user hovers over the back button
- **THEN** a tooltip with the text "返回首页" SHALL appear

### Requirement: Back button is responsive on mobile
The system SHALL ensure the back button has adequate touch target size and remains usable on mobile viewports.

#### Scenario: Mobile touch target
- **WHEN** the viewport width is less than 768px
- **THEN** the back button touch area SHALL be at least 44x44 pixels
