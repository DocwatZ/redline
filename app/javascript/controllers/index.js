import { application } from "controllers/application"

import ChatController         from "controllers/chat_controller"
import DmChatController       from "controllers/dm_chat_controller"
import MessageInputController from "controllers/message_input_controller"
import DmInputController      from "controllers/dm_input_controller"
import PasswordToggleController from "controllers/password_toggle_controller"
import SidebarController      from "controllers/sidebar_controller"
import LinkPreviewController  from "controllers/link_preview_controller"
import ChannelController      from "controllers/channel_controller"
import BottomSheetController  from "controllers/bottom_sheet_controller"
import MediaControlsController from "controllers/media_controls_controller"
import MessageActionsController from "controllers/message_actions_controller"
import NewDmController        from "controllers/new_dm_controller"
import StatusPickerController from "controllers/status_picker_controller"
import SearchController       from "controllers/search_controller"
import InviteController       from "controllers/invite_controller"
import E2eeController         from "controllers/e2ee_controller"
import MarkdownController     from "controllers/markdown_controller"
import UsernameCheckController from "controllers/username_check_controller"
import MemberRoleController    from "controllers/member_role_controller"
import PushOptinController    from "controllers/push_optin_controller"

application.register("chat",            ChatController)
application.register("dm-chat",         DmChatController)
application.register("message-input",   MessageInputController)
application.register("dm-input",        DmInputController)
application.register("password-toggle", PasswordToggleController)
application.register("sidebar",         SidebarController)
application.register("link-preview",    LinkPreviewController)
application.register("channel",         ChannelController)
application.register("bottom-sheet",    BottomSheetController)
application.register("media-controls",  MediaControlsController)
application.register("message-actions", MessageActionsController)
application.register("new-dm",          NewDmController)
application.register("status-picker",   StatusPickerController)
application.register("search",          SearchController)
application.register("invite",          InviteController)
application.register("e2ee",            E2eeController)
application.register("markdown",        MarkdownController)
application.register("username-check",  UsernameCheckController)
application.register("member-role",     MemberRoleController)
application.register("push-optin",      PushOptinController)
