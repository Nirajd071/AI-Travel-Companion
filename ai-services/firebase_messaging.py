import firebase_admin
from firebase_admin import credentials, messaging
import os
from pathlib import Path

class FirebaseMessagingService:
    def __init__(self):
        # Initialize Firebase app if not already initialized
        if not firebase_admin._apps:
            try:
                # Path to service account key file
                service_account_path = Path(__file__).parent.parent / "backend" / "config" / "firebase-service-account.json"
                cred = credentials.Certificate(str(service_account_path))
                firebase_admin.initialize_app(cred)
            except Exception as e:
                print(f"Warning: Firebase initialization failed: {e}")
                print("Running in demo mode without Firebase")
                # Initialize with default app for demo
                firebase_admin.initialize_app()
    
    async def send_notification(self, token: str, title: str, body: str, data: dict = None):
        """
        Send push notification using Firebase Cloud Messaging HTTP v1 API
        
        Args:
            token (str): FCM device token
            title (str): Notification title
            body (str): Notification body
            data (dict): Additional data payload
        
        Returns:
            str: Message ID if successful
        """
        try:
            # Create notification
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            # Create message
            message = messaging.Message(
                notification=notification,
                token=token,
                data=data or {}
            )
            
            # Send message
            response = messaging.send(message)
            print(f"Successfully sent message: {response}")
            return response
            
        except Exception as e:
            print(f"Error sending notification: {str(e)}")
            raise e
    
    async def send_to_multiple_devices(self, tokens: list, title: str, body: str, data: dict = None):
        """
        Send notification to multiple devices
        
        Args:
            tokens (list): List of FCM device tokens
            title (str): Notification title
            body (str): Notification body
            data (dict): Additional data payload
        
        Returns:
            dict: Response with success/failure counts
        """
        try:
            # Create notification
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            # Create multicast message
            message = messaging.MulticastMessage(
                notification=notification,
                tokens=tokens,
                data=data or {}
            )
            
            # Send to multiple devices
            response = messaging.send_multicast(message)
            
            result = {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "responses": []
            }
            
            # Process individual responses
            for idx, resp in enumerate(response.responses):
                if resp.success:
                    result["responses"].append({
                        "token": tokens[idx],
                        "message_id": resp.message_id,
                        "success": True
                    })
                else:
                    result["responses"].append({
                        "token": tokens[idx],
                        "error": str(resp.exception),
                        "success": False
                    })
            
            print(f"Successfully sent to {response.success_count} devices, failed: {response.failure_count}")
            return result
            
        except Exception as e:
            print(f"Error sending multicast notification: {str(e)}")
            raise e
    
    async def send_topic_notification(self, topic: str, title: str, body: str, data: dict = None):
        """
        Send notification to a topic
        
        Args:
            topic (str): Topic name
            title (str): Notification title
            body (str): Notification body
            data (dict): Additional data payload
        
        Returns:
            str: Message ID if successful
        """
        try:
            # Create notification
            notification = messaging.Notification(
                title=title,
                body=body
            )
            
            # Create message for topic
            message = messaging.Message(
                notification=notification,
                topic=topic,
                data=data or {}
            )
            
            # Send message
            response = messaging.send(message)
            print(f"Successfully sent topic message: {response}")
            return response
            
        except Exception as e:
            print(f"Error sending topic notification: {str(e)}")
            raise e

# Global instance
firebase_messaging = FirebaseMessagingService()
