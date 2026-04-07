import { application } from "controllers/application"

import ChatController         from "controllers/chat_controller"
import DmChatController       from "controllers/dm_chat_controller"
import MessageInputController from "controllers/message_input_controller"
import DmInputController      from "controllers/dm_input_controller"
import LivekitController      from "controllers/livekit_controller"
import PasswordToggleController from "controllers/password_toggle_controller"
import SidebarController      from "controllers/sidebar_controller"
import LinkPreviewController  from "controllers/link_preview_controller"

application.register("chat",            ChatController)
application.register("dm-chat",         DmChatController)
application.register("message-input",   MessageInputController)
application.register("dm-input",        DmInputController)
application.register("livekit",         LivekitController)
application.register("password-toggle", PasswordToggleController)
application.register("sidebar",         SidebarController)
application.register("link-preview",    LinkPreviewController)
